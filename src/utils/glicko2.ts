import { GLICKO_DEFAULTS } from '../types';

export interface GlickoState {
  rating: number;
  ratingDeviation: number;
  volatility: number;
}

export interface GlickoOpponent {
  rating: number;
  ratingDeviation: number;
  score: number;
}

export function calculateNewRating(
  state: GlickoState,
  opponents: GlickoOpponent[],
  tau: number = GLICKO_DEFAULTS.tau
): GlickoState {
  if (opponents.length === 0) return { ...state };

  const { rating, ratingDeviation: RD, volatility: sigma } = state;
  const mu = (rating - 1500) / 173.7178;
  const phi = Math.max(RD, 30) / 173.7178;

  const oppData = opponents.map((opp) => ({
    mu_j: (opp.rating - 1500) / 173.7178,
    phi_j: Math.max(opp.ratingDeviation, 30) / 173.7178,
    s_j: opp.score,
  }));

  const g = (p: number) => 1 / Math.sqrt(1 + (3 * p * p) / (Math.PI * Math.PI));
  const E = (m: number, m_j: number, p_j: number) => 1 / (1 + Math.exp(-g(p_j) * (m - m_j)));

  let v = 0;
  for (const opp of oppData) {
    const gPhi = g(opp.phi_j);
    const eVal = E(mu, opp.mu_j, opp.phi_j);
    v += gPhi * gPhi * eVal * (1 - eVal);
  }
  v = 1 / v;

  let deltaSum = 0;
  for (const opp of oppData) {
    const gPhi = g(opp.phi_j);
    const eVal = E(mu, opp.mu_j, opp.phi_j);
    deltaSum += gPhi * (opp.s_j - eVal);
  }
  const delta = v * deltaSum;

  const a = Math.log(sigma * sigma);
  const phiSq = phi * phi;
  const deltaSq = delta * delta;

  function f(x: number): number {
    const ex = Math.exp(x);
    const d = phiSq + v + ex;
    return (ex * (deltaSq - d)) / (2 * d * d) - (x - a) / (tau * tau);
  }

  let A = a;
  let B: number;
  if (deltaSq > phiSq + v) {
    B = Math.log(deltaSq - phiSq - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);
  for (let iter = 0; iter < 100; iter++) {
    if (Math.abs(B - A) <= 1e-10) break;
    const C = A + (A - B) * fA / (fB - fA);
    if (!isFinite(C)) break;
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  const newSigma = Math.exp(A / 2);
  const phiStar = Math.sqrt(phiSq + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSum;

  return {
    rating: Math.max(100, Math.min(3000, 173.7178 * newMu + 1500)),
    ratingDeviation: Math.min(173.7178 * newPhi, 350),
    volatility: Math.max(0.00001, newSigma),
  };
}

export function expectedScore(
  rating: number,
  opponentRating: number,
  opponentRD: number
): number {
  const g = 1 / Math.sqrt(1 + (3 * opponentRD * opponentRD) / (Math.PI * Math.PI));
  return 1 / (1 + Math.exp(-g * (rating - opponentRating)));
}
