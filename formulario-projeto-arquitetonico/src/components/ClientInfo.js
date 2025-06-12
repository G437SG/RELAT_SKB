import React, { useState } from 'react';

const ClientInfo = () => {
    const [clientName, setClientName] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        // Handle form submission logic here
        console.log({
            clientName,
            contactNumber,
            email,
            address,
        });
    };

    return (
        <div className="client-info">
            <h2>Client Information</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="clientName">Name:</label>
                    <input
                        type="text"
                        id="clientName"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="contactNumber">Contact Number:</label>
                    <input
                        type="tel"
                        id="contactNumber"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="address">Address:</label>
                    <input
                        type="text"
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        required
                    />
                </div>
                <button type="submit">Submit</button>
            </form>
        </div>
    );
};

export default ClientInfo;