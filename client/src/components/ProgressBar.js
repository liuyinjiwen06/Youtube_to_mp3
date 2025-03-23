import React from 'react';

const ProgressBar = ({ progress }) => {
  return (
    <div className="mb-6">
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div
          className="bg-blue-600 h-4 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <p className="text-center mt-2 text-gray-600">{`${Math.round(progress)}%`}</p>
    </div>
  );
};

export default ProgressBar; 