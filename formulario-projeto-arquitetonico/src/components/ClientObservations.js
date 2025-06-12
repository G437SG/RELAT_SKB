import React, { useState } from 'react';

const ClientObservations = () => {
    const [observations, setObservations] = useState('');

    const handleChange = (event) => {
        setObservations(event.target.value);
    };

    return (
        <div className="client-observations">
            <h2>Observações do Cliente</h2>
            <textarea
                value={observations}
                onChange={handleChange}
                placeholder="Digite suas observações aqui..."
                rows="5"
                cols="50"
            />
        </div>
    );
};

export default ClientObservations;