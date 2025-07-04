const express = require('express');
const router = express.Router();
const Project = require('../models/Project');

// Route to create a new project
router.post('/projects', async (req, res) => {
    try {
        const projectData = req.body;
        const newProject = new Project(projectData);
        await newProject.save();
        res.status(201).json(newProject);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Route to get all projects
router.get('/projects', async (req, res) => {
    try {
        const projects = await Project.find();
        res.status(200).json(projects);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Route to get a project by ID
router.get('/projects/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.status(200).json(project);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Route to update a project by ID
router.put('/projects/:id', async (req, res) => {
    try {
        const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.status(200).json(project);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Route to delete a project by ID
router.delete('/projects/:id', async (req, res) => {
    try {
        const project = await Project.findByIdAndDelete(req.params.id);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;