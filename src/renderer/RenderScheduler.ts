export class RenderScheduler {
  private frame: number | undefined;
  private dirty = true;
  private destroyed = false;
  private readonly reasons = new Set<string>();

  constructor(private readonly render: (time: number) => void) {}

  markDirty(): void {
    if (this.destroyed) return;
    this.dirty = true;
    this.schedule();
  }
  addReason(reason: string): void {
    if (this.destroyed) return;
    this.reasons.add(reason);
    this.schedule();
  }
  removeReason(reason: string): void {
    this.reasons.delete(reason);
  }
  private schedule(): void {
    if (this.destroyed) return;
    this.frame ??= requestAnimationFrame(this.tick);
  }
  private readonly tick = (time: number): void => {
    if (this.destroyed) return;
    this.frame = undefined;
    if (this.dirty || this.reasons.size > 0) {
      this.dirty = false;
      this.render(time);
    }
    if (this.reasons.size > 0 || this.dirty) this.schedule();
  };
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.reasons.clear();
    this.dirty = false;
  }
}
