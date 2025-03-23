import React from 'react';

const DownloadButton = ({ downloadUrl, fileName }) => {
  return (
    <div className="flex justify-center">
      <a
        href={downloadUrl}
        download={fileName}
        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        下载MP3
      </a>
    </div>
  );
};

export default DownloadButton; 