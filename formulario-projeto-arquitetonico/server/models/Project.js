const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    clientName: {
        type: String,
        required: true
    },
    clientContact: {
        type: String,
        required: true
    },
    propertyAddress: {
        type: String,
        required: true
    },
    propertyType: {
        type: String,
        required: true
    },
    propertySize: {
        type: Number,
        required: true
    },
    projectScope: {
        type: String,
        required: true
    },
    projectTimeline: {
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        }
    },
    clientObservations: {
        type: String,
        default: ''
    }
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;