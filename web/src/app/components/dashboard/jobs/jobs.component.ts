import {Component, OnInit, OnDestroy} from '@angular/core';
import {Router, ActivatedRoute, Params} from '@angular/router';
import {JobService} from '../../../services/job.service';
import {SharedService} from '../../../services/shared.service';
import {DataShareService} from '../../../services/data-share.service';
import {ConstService} from '../../../services/const.service';
import {FormGroup, FormBuilder, Validators} from '@angular/forms';
import {BsModalRef, BsModalService} from 'ngx-bootstrap';
import {JobComponent} from '../../common/job/job.component';
import {Subscription} from 'rxjs';

@Component({
    templateUrl: 'jobs.component.html',
    providers: [JobService, SharedService]
})
export class JobsComponent implements OnInit, OnDestroy {
    url: any;
    isArchive = false;
    jobs = [];
    limit = 10;
    offset = 0;
    jobId = 0;
    job: any;
    jobDetails: FormGroup;
    userList = [];
    modalRef: BsModalRef;
    filter: any;
    jobLoading = false;
    totalItems = 0;
    CurrentPage: any = 1;
    private _subs: Subscription;

    constructor(private jobService: JobService,
                private sharedService: SharedService,
                private router: Router,
                private dataShared: DataShareService,
                private constService: ConstService,
                private modalService: BsModalService,
                private fbForm: FormBuilder) {
        this.url = this.constService.publicUrl;
        this.jobDetails = this.fbForm.group({
            title: [null, [<any>Validators.required]]
        });
    }

    ngOnInit() {
        // this.dataShared.currentMessage.subscribe(jobById => this.jobById = jobById);
        this.filter = {
            pageIndex: 1,
            pageSize: 12,
            searchText: 'title',
            sortField: '',
            sortOrder: '1',
            offset: 0
        };
        this.jobLoading = true;
        this.searchJob();
        this.getUser();
    }

    storeId(jobById: any) {
        this.dataShared.changeMessage(jobById);
    }

    goToPipeline(id: any, title: any, companyName: any) {
        title = title.replace(/[^a-zA-Z 0-9 .]+/g, ' ');
        this.storeId(id);
        this.router.navigate(['/jobs/pipeline/' + id + '/' + title + '/' + companyName]);
    }


    copyText(val: string) {
        const selBox = document.createElement('textarea');
        selBox.value = this.url + val;
        document.body.appendChild(selBox);
        selBox.focus();
        selBox.select();
        document.execCommand('copy');
        document.body.removeChild(selBox);
    }

    searchInterviewer(event, index) {
        // this.interviewerService.getInterviewer(event.target.value).subscribe(result => {
        //     if (result['success']) {
        //         this.jobs[index].userList = result['success']['data'];
        //     }
        // }, (err) => { });
    }

    editJob(job, index) {
        this.createJob(job, index);
    }

    setArchive(falg) {
        this.filter = {
            pageIndex: 1,
            pageSize: 12,
            searchText: 'title',
            sortField: '',
            sortOrder: '1',
            offset: 0
        };
        this.isArchive = falg;
        this.jobs = [];
        this.totalItems = 0;
        this.searchJob();
    }


    archiveJob(jobId, flag, index) {
        this._subs = this.jobService.archiveActiveJob(jobId, flag).subscribe(result => {
            if (result['success'] && result['success']['data']) {
                this.jobs.splice(index, 1);
                this.totalItems = this.totalItems - 1;
            }
        }, (err) => {
            this.jobs = [];
        });
    }

    searchJob(event: any = '') {
        this.filter.searchText = event.target ? event.target.value : event;
        this._subs = this.jobService.getJob(this.filter, !this.isArchive).subscribe(result => {
            if (result['success'] && result['success']['data']) {
                this.jobs = result['success']['data']['jobs'];
                // this.dataShared.notificationChangeMessage({ name: 'success', type: 'Success', message: 'No active job found' })
                this.totalItems = result['success']['data']['count'];
            }
            this.jobLoading = false;
        }, (err) => {
            this.jobs = [];
            this.jobLoading = false;
        });
    }

    getUser() {
        this._subs = this.jobService.getJobsUser().subscribe(result => {
            if (result['success'] && result['success'].data) {
                this.userList = result['success'].data;
            }
        });
    }

    createJob(job, index) {
        this.modalRef = this.modalService.show(JobComponent, {
            class: 'modal-lg',
            initialState: {job: job, userList: this.userList}
        });
        this.modalRef.content.closePopup.subscribe(result => {
            if (result) {
                if (index != null) {
                    this.jobs[index] = result;
                } else {
                    this.jobs.unshift(result);
                }
            }
        });
    }

    filterChanged(refilter) {
        if (refilter == false) {
            this.filter.pageIndex = this.CurrentPage;
            this.filter.offset = (this.CurrentPage - 1) * this.filter.pageSize;
            this.searchJob();
        }
    }

    ngOnDestroy(): void {
        if (this._subs) {
            this._subs.unsubscribe();
        }
    }
}
