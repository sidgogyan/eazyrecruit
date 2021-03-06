var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var company= new Schema({
    name: { type: String, unique: true },
    website: {type: String},
    address_line_1: {type: String},
    address_line_2: {type: String},
    address_line_3: {type: String},
    email: {type: String},
    phone: {type: String},
    logo: { type: String },
    favIcon: { type: String },
    header_description: { type: String },
    header_bg_color: { type: String },
    header_text_color: { type: String },
    is_deleted: {type: Boolean, default: false },
    created_by: {type: Number},
    created_at: { type: Date, default: Date.now },
    modified_by: {type: Number},
    modified_at: { type: Date, default: Date.now },
    groupName: [{
        type: String
    }]
});
company.pre('save', function (next) {
    this.modified_at = new Date;
    return next();
});
company.pre('updateOne', function (next) {
    this.modified_at = new Date;
    return next();
});
company.pre('update', function (next) {
    this.modified_at = new Date;
    return next();
});
module.exports = mongoose.model('Companies', company);
