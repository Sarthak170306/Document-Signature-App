import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useApi } from '../hooks/useApi';

export default function UserSync() {
  const { user, isLoaded, isSignedIn } = useUser();
  const api = useApi();
  const hasSynced = useRef(false);

  useEffect(() => {
    // Perform sync only if the user details are loaded, signed in, and haven't synced yet
    if (isLoaded && isSignedIn && user && !hasSynced.current) {
      hasSynced.current = true;

      const syncUserProfile = async () => {
        try {
          const payload = {
            clerkId: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            name: user.fullName || undefined,
            profileImageUrl: user.imageUrl || undefined,
          };

          const response = await api.post('/auth/sync', payload);
          console.log('[UserSync] Sync completed successfully:', response.data);
        } catch (error) {
          console.error('[UserSync] Failed to sync user profile with backend database:', error);
          // Allow retry on error if needed
          hasSynced.current = false;
        }
      };

      syncUserProfile();
    }
  }, [user, isLoaded, isSignedIn, api]);

  return null;
}
