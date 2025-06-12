import React from 'react';
import ReactDOM from 'react-dom';
import ClientInfo from './components/ClientInfo';
import PropertyInfo from './components/PropertyInfo';
import ProjectScope from './components/ProjectScope';
import ProjectTimeline from './components/ProjectTimeline';
import ClientObservations from './components/ClientObservations';

const App = () => {
    return (
        <div>
            <h1>Relatório de Projeto Arquitetônico</h1>
            <ClientInfo />
            <PropertyInfo />
            <ProjectScope />
            <ProjectTimeline />
            <ClientObservations />
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));