import React from 'react';

const ConverterForm = ({ videoUrl, setVideoUrl, handleConvert, converting }) => {
  return (
    <form onSubmit={handleConvert} className="mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="输入YouTube视频链接"
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={converting}
          required
        />
        <button
          type="submit"
          disabled={converting || !videoUrl}
          className={`px-6 py-2 rounded-lg text-white font-medium ${
            converting || !videoUrl
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {converting ? '转换中...' : '转换为MP3'}
        </button>
      </div>
    </form>
  );
};

export default ConverterForm; 