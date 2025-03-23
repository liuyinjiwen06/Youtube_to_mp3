import axios from 'axios';

const API_URL = '/api';

export const extractAudio = async (videoUrl, onProgress) => {
  const response = await axios.post(
    `${API_URL}/convert`,
    { url: videoUrl },
    {
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        if (onProgress) {
          onProgress({ progress: percentCompleted });
        }
      }
    }
  );
  
  return response.data;
}; 