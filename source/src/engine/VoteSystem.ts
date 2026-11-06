/** Gère un tour de scrutin : bulletins, décompte et égalités. */
export class VoteSystem {
  readonly ballots = new Map<number, number>();

  constructor(
    public readonly voters: number[],
    public readonly candidates: number[],
  ) {}

  /** Candidats pour lesquels un votant donné peut voter (pas lui-même, sauf s'il est seul candidat). */
  candidatesFor(voterId: number): number[] {
    const list = this.candidates.filter((c) => c !== voterId);
    return list.length > 0 ? list : this.candidates;
  }

  cast(voterId: number, targetId: number): void {
    if (!this.voters.includes(voterId)) throw new Error(`Le joueur ${voterId} ne peut pas voter.`);
    if (this.ballots.has(voterId)) throw new Error(`Le joueur ${voterId} a déjà voté.`);
    if (!this.candidatesFor(voterId).includes(targetId)) throw new Error(`Cible de vote invalide : ${targetId}.`);
    this.ballots.set(voterId, targetId);
  }

  nextVoter(): number | undefined {
    return this.voters.find((v) => !this.ballots.has(v));
  }

  isComplete(): boolean {
    return this.ballots.size === this.voters.length;
  }

  tally(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const c of this.candidates) counts.set(c, 0);
    for (const target of this.ballots.values()) counts.set(target, (counts.get(target) ?? 0) + 1);
    return counts;
  }

  /** Candidats ayant reçu le plus de voix (plusieurs en cas d'égalité). */
  leaders(): number[] {
    const counts = this.tally();
    const max = Math.max(...counts.values());
    return [...counts.entries()].filter(([, n]) => n === max).map(([id]) => id);
  }

  ballotsRecord(): Record<number, number> {
    return Object.fromEntries(this.ballots);
  }
}
