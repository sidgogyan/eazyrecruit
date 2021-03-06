import {Component, OnInit, OnDestroy,} from '@angular/core';
import {FormGroup, FormBuilder, Validators} from '@angular/forms';
import {CompanyService} from '../../../../services/company.service';
import {ValidationService} from '../../../../services/validation.service';
import {Subscription} from "rxjs";

@Component({
    selector: 'app-google',
    templateUrl: './google.component.html',
    providers: [CompanyService, ValidationService]
})
export class GoogleComponent implements OnInit, OnDestroy {
    private _subs: Subscription;

    authenticateForm: FormGroup;
    company: any;
    checked: boolean;

    constructor(private companyService: CompanyService,
                private validationService: ValidationService,
                private fbForm: FormBuilder) {
        this.authenticateForm = this.fbForm.group({
            authenticate: [null],
            clientId: [null],
            clientSecret: [null]
        });
    }

    ngOnInit() {
        this.setForm();
    }

    setForm() {
         this._subs = this.companyService.getCompany().subscribe(company => {
            if (company['success']['data']) {
                this.company = company['success']['data'][0];
                 this._subs = this.companyService.getSettings(this.company._id, 'google').subscribe(result => {
                    var settings = result['success']['data'];
                    settings.forEach(setting => {
                        this.authenticateForm.get(setting.key).setValue(setting.value);
                    });
                    if (this.authenticateForm.value.authenticate == "false") {
                        this.checked = false;
                    } else {
                        this.checked = true;
                    }
                })
            } else {
                this.authenticateForm.reset();
            }
        })
    }

    editForm(form) {
        if (!this.authenticateForm.valid && this.checked) {
            this.validationService.validateAllFormFields(this.authenticateForm);
        } else {
             this._subs = this.companyService.editSettings(form, this.company._id, 'google').subscribe(result => {
                if (result['success']) {
                    this.setForm();
                }
            });
        }
    }

    ngOnDestroy(): void {
        if (this._subs) {
            this._subs.unsubscribe();
        }
    }
}
