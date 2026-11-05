/** Optional tuning static: white noise that fades out as the dial lands on a station. */
export function createStatic() {
  let ctx: AudioContext | undefined;
  let gain: GainNode | undefined;

  const start = () => {
    ctx = new AudioContext();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 2400;
    band.Q.value = 0.5;
    gain = ctx.createGain();
    gain.gain.value = 0;
    noise.connect(band).connect(gain).connect(ctx.destination);
    noise.start();
  };

  return {
    /** Returns true when static is now on. */
    async toggle(): Promise<boolean> {
      if (!ctx) {
        start();
        return true;
      }
      if (ctx.state === "running") {
        await ctx.suspend();
        return false;
      }
      await ctx.resume();
      return true;
    },
    /** `offStation` is 0 on a station and 1 halfway between two. */
    update(offStation: number) {
      if (ctx && gain) gain.gain.setTargetAtTime(offStation * 0.16, ctx.currentTime, 0.05);
    },
  };
}
