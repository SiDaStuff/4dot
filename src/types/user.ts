export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  createdAt: number;
  rating: number;
  ratingDeviation: number;
  volatility: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  online: boolean;
  lastSeen: number;
}

export interface FriendRequest {
  id: string;
  from: string;
  fromUsername: string;
  to: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

export interface Friend {
  uid: string;
  username: string;
  online: boolean;
  lastSeen: number;
  rating: number;
}