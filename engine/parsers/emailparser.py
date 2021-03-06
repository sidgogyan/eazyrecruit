import email
import getpass
import imaplib
import os
from textblob.classifiers import NaiveBayesClassifier as NBC
from textblob import TextBlob
from nltk.tokenize import word_tokenize
import base64
from pathlib import Path
import config
import uuid
from models.jobstatusmodel import JobStatusModel
from models.settingsmodel import SettingsModel
from parsers import resumeparser as ResumeParser
import textract
from parsers import resumeanalyse as ResumeAnalyse

def parse():
    try:
        jobstatusmodel = JobStatusModel()
        settingsModel = SettingsModel()
        imapSettings = settingsModel.getImapSettings()

        if imapSettings:
            print("user", imapSettings['user'])
            last_mail_id = jobstatusmodel.get_latest('email', imapSettings['user'])
            print("last_mail_id", last_mail_id)
            if last_mail_id:
                mails, last_mail_id = getRecentMails(imapSettings, last_mail_id)
                resumes = []
                if mails and len(mails) > 0:
                    for mail in mails:
                        if is_resume(mail):
                            resumes.extend(mail["attachments"])
                if last_mail_id:       
                    jobstatusmodel.save_latest('email', imapSettings['user'], last_mail_id)
                return resumes
            else:
                return None
        else:
            print('No IMAP settings was found, It will try again after some time')
            return None
    except:
        print("line 44 emailparser.py")
        return None
       

def getRecentMails(imapSettings, last_mail_id = 0):
    # connecting to the gmail imap server
    # settingsModel = SettingsModel()
    # imapSettings = settingsModel.getImapSettings()
    # print("password", imapSettings['password'])
    try:
        if imapSettings:
            print("host", imapSettings['host'])
            if 'port' in imapSettings:
                print("port", imapSettings['port'])
                m = imaplib.IMAP4_SSL(imapSettings['host'], imapSettings['port'])
            else:
                m = imaplib.IMAP4_SSL(imapSettings['host'])

            m.login(imapSettings['user'], imapSettings['password'])

            if 'folder' in imapSettings:
                print("folder", imapSettings['folder'])
                m.select(imapSettings['folder'])
            else:
                m.select(imapSettings['inbox'])

        
            # you could filter using the IMAP rules here (check http://www.example-code.com/csharp/imap-search-critera.asp)
            resp, items = m.search(None, "ALL") # search and return uids instead
            # no new email
            if not items and len(items) < 1:
                return None
            # extract
            items = items[0].split()  # getting the mails id
            mails = []
            # last_mail_id = 0
            while last_mail_id < len(items):
                # fetching the mail, "`(RFC822)`" means "get the whole stuff", but you can ask for headers only, etc
                resp, data = m.fetch(items[last_mail_id], "(RFC822)")
                email_body = data[0][1].decode('utf-8')  # getting the mail content
                received_email = readMail(email_body)
                
                last_mail_id += 1
                if not received_email:
                    received_email={}
                received_email["id"] = last_mail_id
                mails.append(received_email)
            return mails, last_mail_id
        else:
            return None, None
    except:
        print("line 95 emailparser.py")
        return None, None
    
    

def readMail(email_body):
    # directory where to save attachments (default: current)
    detach_dir = './dump'
    received_email = {}
    # parsing the mail content to get a mail object
    mail = email.message_from_string(email_body)
    received_email['subject'] = mail['Subject']
    received_email['from'] = email.utils.parseaddr(mail['From'])
    #Check if any attachments at all
    if mail.get_content_maintype() != 'multipart':
        return
    # we use walk to create a generator so we can iterate on the parts and forget about the recursive headach
    received_email['attachments'] = []
    for part in mail.walk():
        # multipart are just containers, so we skip them
        if part.get_content_type() == "text/plain":
            received_email['body'] = part.get_payload(decode=True).decode(errors='ignore')
            continue
        if part.get_content_maintype() == 'multipart':
            continue
        # is this part an attachment ?
        if part.get('Content-Disposition') is None:
            continue
        # save file
        att_path = part.get_filename()
        if att_path and att_path.lower().strip().endswith(('.pdf','.docx','.doc')):
            tempFile = os.path.join(detach_dir, uuid.uuid4().hex + os.path.splitext(att_path)[1])
            # finally write the stuff
            fp = open(tempFile, 'wb')
            fp.write(part.get_payload(decode=True))
            fp.close()
            received_email['attachments'].append({'tempFile': tempFile, 'fileName': att_path})
    return received_email

def is_resume(mail):
    try:
        if mail is not None:
            clean_resume_data = None
            clean_rm_subject = None
            clean_rm_body = None
            # parsing email contents
            if 'attachments' in mail:
                for countAttachment in range(len(mail['attachments'])):
                    resume_string = textract.process(mail['attachments'][countAttachment]['tempFile'])
                    resume_string = str(resume_string, 'utf-8')
                    clean_resume_data=ResumeParser.clean_resume(resume_string)
                    if mail['subject']:
                        rm_subject = mail['subject']
                        clean_rm_subject=ResumeParser.clean_resume(rm_subject)
                    if mail['body']:
                        rm_body = mail['body']
                        clean_rm_body=ResumeParser.clean_resume(rm_body)
                    return ResumeAnalyse.analyse_resume(clean_resume_data, clean_rm_body, clean_rm_subject)
    except:
        return False
                
    #subject contains resume
    # if mail.get('subject', None) is not None:
    #     word_tokens = word_tokenize(str(mail['subject']))
    #     for word_token in word_tokens:
    #         if word_token.lower() in ['resume','application','attached','cv', 'profile']:
    #             return True
    #         elif word_token.lower() in ['newsletter']:
    #             return False
                
    # #body contains resume
    # if mail.get('body', None) is not None:
    #     word_tokens = word_tokenize(str(mail['body']))
    #     for word_token in word_tokens:
    #         if word_token.lower() in ['resume','attached', 'cv', 'profile']:
    #             return True
    #         elif word_token.lower() in ['newsletter']:
    #             return False
    
    # if mail["attachments"] and len(mail["attachments"] > 0):
    #     return True

    # return False
    # if str(mail['subject']).find('resume') >= 0 or mail['subject'].find('attached') >= 0:
    #     return True
    # if mail['body'] and (str(mail['body']).find('resume') >= 0 or str(mail['body']).find('attached') >= 0):
    #     return True
    # return False

def mail_corpus():
    training_corpus = [
        ('resume', 'RESUME'),
        ("attached resume", 'RESUME'),
        ('latest resume', 'RESUME'),
        ('update resume', 'RESUME'),
        ('resume attached', 'RESUME'),
        ('cv', 'RESUME'),
        ("attached cv", 'RESUME'),
        ('latest cv', 'RESUME'),
        ('update cv', 'RESUME'),
        ('cv attached', 'RESUME')
        ]
    return training_corpus

def get_document_content(attachment):
    with open(attachment, 'rb') as attchment_doc: # open binary file in read mode
        return base64.b64encode(attchment_doc.read())
