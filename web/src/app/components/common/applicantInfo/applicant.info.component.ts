import {Component, OnInit, OnDestroy , Input, Output, EventEmitter, OnChanges, TemplateRef} from '@angular/core';
import {FormBuilder} from '@angular/forms';
import {UploadService} from '../../../services/upload.service';
import {SearchService} from '../../../services/search.service';
import {ApplicantInfoService} from './applicant-info.service';
import {ValidationService} from '../../../services/validation.service';
import {InterviewService} from '../../../services/interview.service';
import {AccountService} from '../../../services/account.service';
import {ActivatedRoute} from '@angular/router';
import {Subscription} from "rxjs";

declare global {
    interface Window {
        editApplicantPopup: any;
    }
}

@Component({
    selector: 'applicant-info',
    templateUrl: './applicant.info.component.html',
    providers: [UploadService, SearchService, ApplicantInfoService, ValidationService, InterviewService, AccountService]
})
export class ApplicantInfoComponent implements OnInit, OnChanges, OnDestroy {
    gettingApplicant = false;
    jobLoad = false;
    jobId: any;
    jobsSkils = {};
    isActivityUpdate = true;
    SkillDiv = '';
    showComments = false;
    applyJobs: any = [];
    @Input()
    applicant?: any;
    private _subs: Subscription;
    @Output()
    onReject: EventEmitter<any> = new EventEmitter();

    @Output()
    onUpdate: EventEmitter<any> = new EventEmitter();
    @Output()
    onCancelInterview: EventEmitter<any> = new EventEmitter();

    applicantData?: any;

    constructor(
        private route: ActivatedRoute,
        private uploadService: UploadService,
        private searchService: SearchService,
        private interviewService: InterviewService,
        private fb: FormBuilder,
        private applicantInfoService: ApplicantInfoService
    ) {
    }

    ngOnInit() {
        this.jobId = this.route.params['value'].jobId;
        this.applicant = null;
        this.applicantData = null;
    }

    ngOnChanges() {
        if (this.applicant) {
            this.SkillDiv = '';
            this.gettingApplicant = true;
            document.getElementById('history').click();
            this.getApplicantById(this.applicant._id);
            this.getJobsByApplicantId();
        }
    }

    getFullName(firstName, middleName, lastName) {
        let name = firstName;
        if (middleName && middleName != 'null') name = name + ' ' + middleName;
        if (lastName && lastName != 'null') name = name + ' ' + lastName;
        return name;
    }

    getApplicantById(id: string) {
        this.applicantInfoService.getApplicantById(id).subscribe(result => {
            if (result) {
                this.applicant = result['success']['data'];
                this.applicantData = result['success']['data'];
                this.applicant.fullName = this.getFullName.bind(this.applicant);
                this.applicantData.fullName = this.getFullName.bind(this.applicantData);
            }
            this.gettingApplicant = false;
        }, () => {
            this.gettingApplicant = false;
        });
    }

    getJobsByApplicantId() {
        if (this.applicant._id) {
            this.applicantInfoService.getJobsByApplicantId(this.applicant._id).subscribe(result => {
                if (result && result['success'] && result['success']['data'] && result['success']['data'].length) {
                    this.applicant.jobs = result['success']['data'];
                    this.setJobsSkils(result['success']['data']);
                } else {
                    this.jobLoad = true;
                }
            }, () => {
                this.jobLoad = true;
            });
        }
    }

    setJobsSkils(jobsApplicants) {
        this.jobsSkils = {};
        this.applyJobs = [];
        for (let index = 0; index < jobsApplicants.length; index++) {
            const job = jobsApplicants[index].job || {};
            job['pipeline'] = jobsApplicants[index].pipeline;
            this.applyJobs.push(job);
            if (job.skills && job.skills.length) {
                for (let count = 0; count < job.skills.length; count++) {
                    this.jobsSkils[job.skills[count].name.toUpperCase()] = job.skills[count].name;
                }
            }
        }
        this.jobLoad = true;

    }

    commentAdded() {
        this.isActivityUpdate = !this.isActivityUpdate;
    }

    getComments() {
        this.showComments = true;
    }

    onUpdateProfile(result) {
        this.isActivityUpdate = !this.isActivityUpdate;
        this.getApplicantById(this.applicant._id);
        this.onUpdate.emit(result);
    }

    onCancelInterviewData(result) {
        this.isActivityUpdate = !this.isActivityUpdate;
        this.onCancelInterview.emit(result);
    }

    onUpdateInterview(result) {
        this.isActivityUpdate = !this.isActivityUpdate;
    }
    ngOnDestroy(): void {
        if (this._subs) {
            this._subs.unsubscribe();
        }
    }
}
