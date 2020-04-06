export class ConstService {
    baseUrl: string;
    publicUrl: string;
    pyUrl: string;
    constructor() {
        if (window.location.hostname === 'dev.eazyrecruit.in') {
            this.baseUrl = '/api/';
            this.publicUrl = '/jobs/';
            this.pyUrl = '/api/engine/';
        } else if (window.location.hostname === 'web.eazyrecruit.in') {
            this.publicUrl = '/jobs/';
            this.baseUrl = '/api/';
            this.pyUrl = '/api/engine/';
        } else {
            this.publicUrl = 'http://localhost:8082/jobs/';
            this.baseUrl = '/api/';
            this.pyUrl = '/api/engine/';
        }

    }
}
