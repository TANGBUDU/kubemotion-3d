export class RenderScheduler {
  private frame: number | undefined;
  private dirty = true;
  private readonly reasons = new Set<string>();

  constructor(private readonly render: (time: number) => void) {}

  markDirty(): void {
    this.dirty = true;
    this.schedule();
  }
  addReason(reason: string): void {
    this.reasons.add(reason);
    this.schedule();
  }
  removeReason(reason: string): void {
    this.reasons.delete(reason);
  }
  private schedule(): void {
    this.frame ??= requestAnimationFrame(this.tick);
  }
  private readonly tick = (time: number): void => {
    this.frame = undefined;
    if (this.dirty || this.reasons.size > 0) {
      this.dirty = false;
      this.render(time);
    }
    if (this.reasons.size > 0 || this.dirty) this.schedule();
  };
  destroy(): void {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.reasons.clear();
  }
}
