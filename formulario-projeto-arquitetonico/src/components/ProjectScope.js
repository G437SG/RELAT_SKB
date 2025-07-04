import React, { useState } from 'react';

const ProjectScope = () => {
    const [scopeDetails, setScopeDetails] = useState('');

    const handleChange = (event) => {
        setScopeDetails(event.target.value);
    };

    return (
        <div className="project-scope">
            <h2>Definição do Escopo do Projeto</h2>
            <textarea
                value={scopeDetails}
                onChange={handleChange}
                placeholder="Descreva o escopo do projeto aqui..."
                rows="5"
                cols="50"
            />
        </div>
    );
};

export default ProjectScope;