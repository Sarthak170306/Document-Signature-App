import axios, { AxiosInstance } from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { useMemo } from 'react';

export interface ExtendedAxiosInstance extends AxiosInstance {
  getDocuments: () => Promise<any>;
  uploadDocument: (file: File) => Promise<any>;
  shareDocument: (documentId: string, signerEmail: string, signerName: string) => Promise<any>;
}

export const useApi = (): ExtendedAxiosInstance => {
  const { getToken } = useAuth();

  const apiInstance = useMemo(() => {
    const instance = axios.create({
      baseURL: 'http://localhost:5000/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Intercept outgoing requests to attach Clerk session token dynamically
    instance.interceptors.request.use(
      async (config) => {
        try {
          const token = await getToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('[useApi] Failed to resolve auth token:', error);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    return instance;
  }, [getToken]);

  const extendedApi = useMemo(() => {
    const getDocuments = async () => {
      const response = await apiInstance.get('/docs');
      return response.data;
    };

    const uploadDocument = async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiInstance.post('/docs/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    };

    const shareDocument = async (documentId: string, signerEmail: string, signerName: string) => {
      const response = await apiInstance.post('/docs/share', {
        documentId,
        signerEmail,
        signerName
      });
      return response.data;
    };

    return Object.assign(apiInstance, {
      getDocuments,
      uploadDocument,
      shareDocument,
    });
  }, [apiInstance]);

  return extendedApi as ExtendedAxiosInstance;
};
