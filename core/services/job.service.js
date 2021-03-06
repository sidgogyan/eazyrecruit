var Jobs = require('../models/job');
var JobPipelines = require('../models/jobPipeline');
var JobApplicants = require('../models/jobApplicant');
var Interview = require('../models/interview');
var emailService = require('../services/email.service');
var histroyService = require('../services/history.service');
var utilService = require('../services/util.service');
var esService = require('../services/es.service');
var ObjectId = require('mongodb').ObjectID;
var Activity = require('./activity.service');
var User = require('../models/user');
var config = require('../config').config();
var Role = require('../models/userRole');
var Applicants = require('../models/applicant');
exports.save = async (req) => {
    if (req.body) {
        var modelJob = await Jobs.findById(req.body._id);
        if (modelJob == null) {
            modelJob = new Jobs();
            modelJob.created_by = req.user.id;
            modelJob.created_at = new Date();
            modelJob.modified_at = new Date();

            let name = ['New', 'Pending', 'Hold', 'Selected', 'Rejected'];
            req.body['jobId'] = modelJob._id;
            req.body['pipeline'] = [];
            for (let i = 0; i < name.length; i++) {
                var jobPipeline = new JobPipelines();
                jobPipeline.name = name[i];
                jobPipeline.position = i + 1;
                jobPipeline.created_by = req.user.id;
                jobPipeline.created_at = new Date();
                jobPipeline.modefied_by = req.user.id;
                jobPipeline.modefied_at = new Date();
                jobPipeline.is_deleted = false;
                req.body.pipeline.push(jobPipeline);
                await jobPipeline.save();
            }
        }

        modelJob.title = req.body.title;
        if (req.body.vendors) {
            modelJob.vendors = [];
            req.body.vendors = JSON.parse(req.body.vendors);
            modelJob.vendors = req.body.vendors;
        }
        modelJob.recruitmentManager = req.body.recruitmentManager || modelJob.recruitmentManager;
        modelJob.guid = modelJob.guid || createSlug(req.body.title);
        modelJob.active = req.body.active ? req.body.active : true;
        modelJob.description = req.body.description ? req.body.description : null;
        modelJob.responsibilities = req.body.responsibilities ? req.body.responsibilities : null;
        modelJob.ctc = req.body.ctc ? req.body.ctc : null;
        modelJob.minExperience = req.body.minExperience ? req.body.minExperience : null;
        modelJob.maxExperience = req.body.maxExperience ? req.body.maxExperience : null;
        modelJob.type = req.body.type ? req.body.type : null;
        modelJob.mode = req.body.mode ? req.body.mode : null;
        if (req.body.locations) {
            modelJob.locations = [];
            req.body.locations = JSON.parse(req.body.locations);
            for (var iLoc = 0; iLoc < req.body.locations.length; iLoc++) {
                modelJob.locations.push(req.body.locations[iLoc]._id);
            }
        }
        if (req.body.pipeline) {
            for (var iPipeline = 0; iPipeline < req.body.pipeline.length; iPipeline++) {
                modelJob.pipelines.push(req.body.pipeline[iPipeline]._id);
            }
        }
        if (req.body.skills) {
            modelJob.skills = [];
            req.body.skills = JSON.parse(req.body.skills);
            for (var iSkill = 0; iSkill < req.body.skills.length; iSkill++) {
                modelJob.skills.push(req.body.skills[iSkill]._id);
            }
        }
        modelJob.expiryDate = req.body.expiryDate ? req.body.expiryDate : null;
        if (req.body.is_published) {
            modelJob.is_published = req.body.is_published == 'true' ? true : false;
        } else {
            modelJob.is_published = false;
        }

        // we are storing image with name and we are using guid as name
        if (req.files && req.files.length) {
            modelJob.metaImage = await utilService.readWriteFile(req.files[0], modelJob.guid);
        }

        modelJob.metaImageAltText = req.body.metaImageAltText ? req.body.metaImageAltText : null;
        modelJob.metaTitle = req.body.metaTitle ? req.body.metaTitle : null;
        if (req.body.tags) {
            req.body.tags.forEach(tag => {
                modelJob.tags.push(tag._id);
            });
        }
        if (req.body.categories) {
            req.body.categories.forEach(category => {
                modelJob.categories.push(category._id);
            });
        }
        modelJob.modified_by = req.user.id;
        modelJob.modified_at = new Date();
        modelJob = await modelJob.save();

        return modelJob;
    } else {
        return new Error('job data is missing');
    }
}

exports.archive = async (data) => {
    if (data.id) {
        var modelJob = await Jobs.findById(data.id);
        if (modelJob) {
            modelJob["active"] = (data.status === "true" || data.status === true);
            modelJob.modified_by = data.user.id;
            modelJob.modified_at = new Date();
            return await modelJob.save();

        } else {
            return new Error('job data is missing');
        }
    } else {
        return new Error('job data is missing');
    }

}
exports.getPublishedJobs = async (query, limit, offset) => {
    let count = 0;
    let jobs;
    if (query.hasOwnProperty('title')) {
        count = await Jobs.find(query).countDocuments();
        jobs = await Jobs.find(query).populate("locations").populate("skills")
            .populate("tags").populate("categories").sort({created_at: 'desc'});

    } else {
        count = await Jobs.find(query).countDocuments();
        jobs = await Jobs.find(query).populate("locations").populate("skills")
            .populate("tags").populate("categories").sort({created_at: 'desc'}).limit(limit).skip(offset);
    }
    return {count, jobs};
};

exports.getByGuid = async (guid) => {
    return await Jobs.findOne({'guid': guid}).populate("locations").populate("skills")
        .populate("tags").populate("categories");
};

exports.getById = async (_id) => {
    return await Jobs.findById(_id).populate("locations").populate("skills")
        .populate("tags").populate("categories");
};

exports.getWithApplicantsAndPipeline = async (req) => {
    return await Jobs.findById(req.params.id)
        .populate({
            path: 'pipelines', match: {is_deleted: {$ne: true}},
            populate: {
                path: 'pipelines',
                model: 'JobPipelines'
            }
        })
        .populate({
            path: 'applicants', match: {is_deleted: {$ne: true}},
            populate: {
                path: 'applicant',
                model: 'Applicants',
                match: {is_deleted: {$ne: true}},
                populate: {
                    path: 'skills',
                    model: 'Skills'
                }
            }
        });
};

exports.getJobsPipeLine = async (req) => {
    let query = {is_deleted: {$ne: true}};

    if (req.query.jobId) {
        query["_id"] = req.query.jobId;
    }

    return await Jobs.find(query, {title: 1, pipelines: 1})
        .populate({
            path: 'pipelines', match: {is_deleted: {$ne: true}},
            populate: {
                path: 'pipelines',
                model: 'JobPipelines'
            }
        });
};


exports.getJobsApplicant = async (data) => {
    try {
        const ApplicantQuery = {
            "Applicants.is_deleted": {$ne: true}
        };
        const jobApplicantsQuery = {
            "is_deleted": {$ne: true},
            "job": {
                "$exists": true
            }
        };
        if (data.jobId) {
            jobApplicantsQuery["job"] = ObjectId(data.jobId);
        }
        const result = {total: 0, records: []};
        let sort = {};
        if (data.sortBy === "modified_at") {
            sort["modified_at"] = parseInt(data.order);
        } else {
            sort["Applicants." + data.sortBy] = parseInt(data.order);
        }

        if (data.source) {
            ApplicantQuery["Applicants.source"] = data.source;
        }
        if (data.startDate && data.endDate) {
            jobApplicantsQuery["modified_at"] = {
                $gt: data.startDate,
                $lt: data.endDate
            }
        }
        if (data.searchText) {
            ApplicantQuery["$or"] = [
                {"Applicants.firstName": {"$regex": data.searchText}},
                {"Applicants.middleName": {"$regex": data.searchText}},
                {"Applicants.lastName": {"$regex": data.searchText}},
                {"Applicants.email": {"$regex": data.searchText}},
            ]
        }
        let ApplicantLookupCount = await JobApplicants.aggregate(getApplicantLookupCount(ApplicantQuery, jobApplicantsQuery));
        const count = ApplicantLookupCount && ApplicantLookupCount.length && ApplicantLookupCount[0].count ? ApplicantLookupCount[0].count : 0;
        if (count > 0) {
            let project = {"$project": {}};
            let select = geApplicantSelect();
            for (let index = 0; index < select.length; index++) {
                project.$project["Applicants." + select[index]] = 1;
            }
            project.$project["_id"] = 1;
            project.$project["job"] = 1;
            project.$project["pipeline"] = 1;
            project.$project["modified_at"] = 1;
            project.$project["created_at"] = 1;
            result.total = count;
            result.records = await JobApplicants.aggregate(getApplicantLookup(ApplicantQuery, jobApplicantsQuery, sort, parseInt(data.limit), parseInt(data.offset), project));
        }

        return result;
    } catch
        (error) {
        console.log("errorerror", error);
        return {total: 0, records: []};
    }


}
;


function getApplicantLookup(ApplicantQuery, jobApplicantsQuery, sort, limit, skip, project) {

    let query = [{
        "$match": jobApplicantsQuery
    }, {
        "$lookup":
            {
                "from": "applicants",
                "localField": "applicant",
                "foreignField": "_id",
                "as": "Applicants"
            }

    },
        {"$unwind": "$Applicants"},

        {
            "$match": ApplicantQuery
        },
        {"$sort": sort},
        {"$skip": skip},
        {"$limit": limit},
        project
    ];
    console.log("query,", JSON.stringify(query));
    return query;

}

function getApplicantLookupCount(ApplicantQuery, jobApplicantsQuery) {
    let query = [{
        "$match": jobApplicantsQuery
    }, {
        "$lookup":
            {
                "from": "applicants",
                "localField": "applicant",
                "foreignField": "_id",
                "as": "Applicants"
            }

    },
        {"$unwind": "$Applicants"},

        {
            "$match": ApplicantQuery
        },
        {
            "$count": "count"
        }
    ];


    console.log("getApplicantLookupCount,", JSON.stringify(query));
    return query;
}

exports.delete = async (_id) => {
    var modelJob = Jobs.findById(req.body._id);
    if (modelJob) {
        modelJob.is_deleted = true;
        modelJob.modified_by = req.user.id;
        modelJob.modified_at = new Date();
        return await modelJob.save();
    }
    throw 'invalid id';
};

let addPipeline = async (req) => {
    var modelJob = await Jobs.findById(req.body.jobId);
    if (modelJob) {
        // Create Job Pipeline
        if (req.body.pipeline.length > 0) {
            try {
                let jobPipeline = await JobPipelines.create(req.body.pipeline);
                for (let i = 0; i < jobPipeline.length; i++) {
                    if (modelJob.pipelines == null) {
                        modelJob.pipelines = [];
                    }
                    modelJob.pipelines.push(jobPipeline[i]._id);
                }
            } catch (exception) {
                console.log(exception);
            }

            // Link with Job

            // if (modelJob.pipelines == null) {
            //     modelJob.pipelines = [];
            // }
            // modelJob.pipelines.push(jobPipeline._id);
        } else {
            var jobPipeline = new JobPipelines();
            jobPipeline.name = req.body.pipeline.name;
            jobPipeline.position = req.body.pipeline.position;
            jobPipeline.created_by = req.user.id;
            jobPipeline.created_at = new Date();
            jobPipeline.modefied_by = req.user.id;
            jobPipeline.modefied_at = new Date();
            jobPipeline = await jobPipeline.save();
            // Link with Job
            if (modelJob.pipelines == null) {
                modelJob.pipelines = [];
            }
            modelJob.pipelines.push(jobPipeline._id);
        }

        modelJob = await modelJob.save();
        return jobPipeline;
    }
}

exports.editPipeLine = async (data) => {
    var pipeLine = await JobPipelines.findById(data._id);
    if (pipeLine) {
        pipeLine["name"] = data.name || pipeLine["name"];
        pipeLine = await pipeLine.save();
        return pipeLine;
    } else {
        return new Error('invalid pipeline id');
    }
}
exports.addPipeline = addPipeline;

exports.addApplicant = async (req) => {
    var modelJob = await Jobs.findById(req.body.jobId);
    if (modelJob) {
        let applicant = await JobApplicants.findOne({
            applicant: req.body.applicantId,
            job: req.body.jobId,
            is_deleted: {$ne: true}
        });
        if (!applicant) {
            // Create Job Applicant
            let jobApplicant = new JobApplicants();
            jobApplicant.applicant = req.body.applicantId;
            jobApplicant.pipeline = req.body.pipelineId || modelJob.pipelines[0];
            jobApplicant.job = req.body.jobId;
            jobApplicant.created_by = req.user.id;
            jobApplicant.created_at = Date.now();
            jobApplicant.modefied_by = req.user.id;
            jobApplicant.modefied_at = Date.now();
            jobApplicant.is_deleted = false;
            jobApplicant = await jobApplicant.save();
            // Link with Job
            if (modelJob.applicants == null) {
                modelJob.applicants = [];
            }
            modelJob.applicants.push(jobApplicant._id);

            modelJob = await modelJob.save();
            let description = "applicant added for  " + modelJob.title + " profile";

            let jobPipeline = await JobPipelines.findOne({_id: jobApplicant.pipeline});
            if (jobPipeline.name) {
                description = description + " and move to " + jobPipeline.name + " pipeline ";
            }
            Activity.addActivity({
                applicant: req.body.applicantId,
                created_by: req.user.id,
                title: "Added to Job",
                description: description
            });
            await histroyService.create({
                applicant: req.body.applicantId,
                pipeline: req.body.pipelineId,
                job: req.body.jobId,
                createdBy: req.user.id,
                modifiedBy: req.user.id,
            });
            notifyHRForApply(req.body.applicantId, modelJob.title, req.user.email);
            return jobApplicant;
        } else {
            return {status: 403, message: "already exist"};
        }
    }
}
exports.getJobsName = async (jobId) => {
    let query = {
        is_deleted: {$ne: true}
    };
    if (jobId) {
        query["_id"] = jobId;
    }
    try {
        return await Jobs.find(query, {title: 1});
    } catch (e) {
        return {status: 400, message: "invalid id"};
    }

}
exports.editApplicant = async (req) => {

    let applicant = await JobApplicants.findOne({
        _id: req.body.id,
        applicant: req.body.applicant,
        is_deleted: false
    }).populate("job");
    if (applicant) {
        applicant.pipeline = req.body.pipeline;
        applicant.modefied_by = req.user.id;
        applicant.modefied_at = Date.now();
        applicant.is_deleted = false;
        await applicant.save();
        let description = "applicant update for  " + applicant.job.title + " profile";

        let jobPipeline = await JobPipelines.findOne({_id: req.body.pipeline});
        if (jobPipeline.name) {
            description = description + " and move to " + jobPipeline.name + " pipeline ";
        }
        Activity.addActivity({
            applicant: req.body.applicant,
            created_by: req.user.id,
            title: "Pipeline Updated",
            description: description
        });
        await histroyService.create({
            applicant: req.body.applicant,
            pipeline: req.body.pipeline,
            job: req.body.job,
            createdBy: req.user.id,
            modifiedBy: req.user.id,
        });
        return applicant;
    } else {
        return {status: 400, message: "invalid id"};
    }
}

exports.removeApplicant = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (req.params.id) {
                let jobApplicant = await JobApplicants.findByIdAndUpdate(req.params.id, {is_deleted: true}, {new: true}).populate("job");
                if (jobApplicant) {
                    let description = "applicant remove from  " + jobApplicant.job.title + " profile";
                    Activity.addActivity({
                        applicant: jobApplicant.applicant,
                        created_by: req.user.id,
                        title: "Applicant remove from Job",
                        description: description
                    });
                    await histroyService.create({
                        applicant: jobApplicant.applicant,
                        pipeline: req.body.pipeline,
                        job: req.body.job,
                        createdBy: req.user.id,
                        modifiedBy: req.user.id,
                    });
                    let job = await Jobs.findByIdAndUpdate(jobApplicant.job, {$pull: {applicants: req.params.id}}, {new: true});
                    let elJob = await esService.updateJob(job.id, job);
                    let interview = await Interview.findOne({
                        jobId: jobApplicant.job,
                        jobApplicant: jobApplicant.applicant
                    });
                    if (interview) {
                        try {
                            interview.is_deleted = true;
                            interview.modified_at = new Date();
                            interview.modified_by = req.user.id;
                            interview.save((err, data) => {
                                if (err) {
                                    reject({
                                        status: 207,
                                        message: "applicant removed successfully, interview remove error"
                                    });
                                } else {
                                    let description = "Interview remove for " + jobApplicant.job.title + " profile";
                                    Activity.addActivity({
                                        applicant: jobApplicant.applicant,
                                        created_by: req.user.id,
                                        title: "Interview remove",
                                        description: description
                                    });
                                    resolve(jobApplicant);
                                }
                            });
                        } catch (error) {
                            console.log('remove interview : ', error);
                            reject({status: 207, message: "applicant removed successfully, interview remove error"});
                        }
                    } else {
                        resolve(jobApplicant);
                    }
                } else {
                    reject({status: 400, message: "invalid id"});
                }
            } else {
                reject({status: 400, message: "id required"});
            }
        } catch (error) {
            console.log('remove applicanr error : ', error);
            reject({status: 500, message: "internal server error"});
        }
    });
}


function notifyHRForApply(applicantId, jobName, owner) {
    return new Promise(async (resolve, reject) => {
        // Get all HR (role = 2
        let applicant = await Applicants.findOne({_id: applicantId});
        if (!applicant) {
            return null;
        }
        let hrRole = await Role.findOne({name: "hr"});
        if (hrRole) {
            var hrTeam = await User.find({is_deleted: false, roles: {$elemMatch: {$eq: hrRole}}});
            if (hrTeam && hrTeam.length > 0) {
                // Get list of hr emails
                var hrEmails = "";
                hrTeam.forEach(hr => {
                    if (owner !== hr.email) {
                        hrEmails = hrEmails + hr.email + ","
                    }
                });

                var body = `
                <p>Dear HR,</p>
                <p>A candidate is  referred by ${owner} for the Job <b> ${jobName}</p>
                <p> <b>Candidate Name:</b>  ${getName(applicant)}<br>
               <b> Email:</b> ${applicant.email}<br>
               <b> Phone:</b> ${applicant.phones[0]}<br>
                <p>Please click on below link to view details<p>
                <p>${config.website}/admin/applicants/${applicantId}</p>
            `;
                var email = {
                    toEmail: hrEmails, // list of receivers
                    subject: "Applicant for the job", // Subject line
                    body: body,
                    title: "Applicant for the job"
                };
                if (hrEmails) {
                    emailService.sendEmail(email, (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                }
            }
        }


    });
}

function getName(data) {
    let name = data.firstName;
    if (data.middleName) {
        name = name + " " + data.middleName;
    }
    if (data.middleName) {
        name = name + " " + data.middleName;
    }
    if (data.lastName) {
        name = name + " " + data.lastName;
    }
    return name;
}

function createSlug(title) {
    let date = new Date();
    let month = date.getMonth() + 1;
    let day = date.getDate() > 10 ? date.getDate() : "0" + date.getDate();
    month = month > 10 ? month + 1 : "0" + month;
    let year = date.getFullYear() % 2000;
    return title.replace(/[^\w\s]/gi, '').replace(/\s/g, '').toLowerCase() + "_" + date.getDate() + month + year;
}

function geApplicantSelect() {
    return ["_id", "firstName", "middleName", "lastName", "dob", "email", "phones", "currentCtc", "score", "expectedCtc", "noticePeriod", "noticePeriodNegotiable", "totalExperience", "availability", "modified_at", "created_at", "roles", "referredBy", "referredBy", "source"]
}



