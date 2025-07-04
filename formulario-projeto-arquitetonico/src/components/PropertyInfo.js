import React, { useState } from 'react';

const PropertyInfo = () => {
    const [address, setAddress] = useState('');
    const [propertyType, setPropertyType] = useState('');
    const [size, setSize] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const propertyData = {
            address,
            propertyType,
            size,
        };
        console.log('Property Information Submitted:', propertyData);
        // Here you can add functionality to send the data to a server or handle it as needed
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>Property Information</h2>
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
            <div>
                <label htmlFor="propertyType">Property Type:</label>
                <input
                    type="text"
                    id="propertyType"
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    required
                />
            </div>
            <div>
                <label htmlFor="size">Size (in sq ft):</label>
                <input
                    type="number"
                    id="size"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    required
                />
            </div>
            <button type="submit">Submit</button>
        </form>
    );
};

export default PropertyInfo;