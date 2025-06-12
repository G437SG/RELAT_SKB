import React, { useState } from 'react';

const ProjectTimeline = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const handleStartDateChange = (event) => {
        setStartDate(event.target.value);
    };

    const handleEndDateChange = (event) => {
        setEndDate(event.target.value);
    };

    return (
        <div className="project-timeline">
            <h2>Project Timeline</h2>
            <form>
                <div>
                    <label htmlFor="start-date">Start Date:</label>
                    <input 
                        type="date" 
                        id="start-date" 
                        value={startDate} 
                        onChange={handleStartDateChange} 
                        required 
                    />
                </div>
                <div>
                    <label htmlFor="end-date">End Date:</label>
                    <input 
                        type="date" 
                        id="end-date" 
                        value={endDate} 
                        onChange={handleEndDateChange} 
                        required 
                    />
                </div>
            </form>
        </div>
    );
};

export default ProjectTimeline;