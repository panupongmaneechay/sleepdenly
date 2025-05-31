import React from 'react';
import './InformationPanel.css'; // Create this CSS file

function InformationPanel({ info }) {
  return (
    <div className="information-panel">
      <h2>Information</h2>
      <p><strong>Name:</strong> {info.name}</p>
      <p><strong>Age:</strong> {info.age}</p>
      <p className="info-description"><strong>Description:</strong> {info.description}</p>
    </div>
  );
}

export default InformationPanel;