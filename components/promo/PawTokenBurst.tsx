"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { gsap } from "gsap";
import { Physics2DPlugin } from "gsap/Physics2DPlugin";
import styles from "./PawTokenBurst.module.css";

gsap.registerPlugin(Physics2DPlugin);

type Props = {
  active: boolean;
  x: number;
  y: number;
};

type Particle = {
  id: number;
  originX: number;
  originY: number;
  size: number;
  velocity: number;
  angle: number;
  gravity: number;
  friction: number;
  duration: number;
  rotation: number;
  turnDuration: number;
  turnDelay: number;
  reverseTurn: boolean;
  depth: number;
};

type ParticleStyle = CSSProperties & {
  "--token-size": string;
  "--turn-duration": string;
  "--turn-delay": string;
};

const MAX_PARTICLES = 24;
const EMISSION_ANGLES = [18, 162, 42, 138, 72, 108, 4, 176, 90] as const;

const between = (min: number, max: number) =>
  min + Math.random() * (max - min);

function createParticle(id: number, x: number, y: number): Particle {
  const baseAngle = EMISSION_ANGLES[id % EMISSION_ANGLES.length];
  const direction = baseAngle > 90 ? -1 : 1;
  const depth = between(0.82, 1.08);

  return {
    id,
    originX: x + between(-6, 6),
    originY: y + between(-2, 3),
    size: between(30, 46) * depth,
    velocity: between(220, 390),
    angle: baseAngle + between(-11, 11),
    gravity: between(680, 980),
    friction: between(0.025, 0.07),
    duration: between(0.9, 1.32),
    rotation: direction * between(440, 980),
    turnDuration: between(0.52, 0.76),
    turnDelay: -between(0, 0.7),
    reverseTurn: Math.random() > 0.5,
    depth,
  };
}

function PawParticle({
  particle,
  onComplete,
}: {
  particle: Particle;
  onComplete: (id: number) => void;
}) {
  const tokenRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const token = tokenRef.current;
    if (!token) return;

    const context = gsap.context(() => {
      gsap.set(token, {
        xPercent: -50,
        yPercent: -50,
        opacity: 0,
        scale: 0.28,
        rotation: between(-18, 18),
      });

      gsap.to(token, {
        duration: particle.duration,
        ease: "none",
        physics2D: {
          velocity: particle.velocity,
          angle: particle.angle,
          gravity: particle.gravity,
          friction: particle.friction,
        },
        onComplete: () => onComplete(particle.id),
      });

      gsap
        .timeline()
        .to(
          token,
          {
            opacity: 1,
            scale: particle.depth,
            duration: 0.14,
            ease: "back.out(2.2)",
          },
          0,
        )
        .to(
          token,
          {
            rotation: particle.rotation,
            duration: particle.duration,
            ease: "none",
          },
          0,
        )
        .to(
          token,
          {
            opacity: 0,
            scale: particle.depth * 0.72,
            duration: particle.duration * 0.24,
            ease: "power2.in",
          },
          particle.duration * 0.76,
        );
    }, token);

    return () => context.revert();
  }, [onComplete, particle]);

  const style: ParticleStyle = {
    left: particle.originX,
    top: particle.originY,
    "--token-size": `${particle.size}px`,
    "--turn-duration": `${particle.turnDuration}s`,
    "--turn-delay": `${particle.turnDelay}s`,
  };

  return (
    <span className={styles.token} style={style} ref={tokenRef}>
      <span
        className={`${styles.sprite} ${
          particle.reverseTurn ? styles.reverse : ""
        }`}
      >
        <span className={`${styles.view} ${styles.faceA}`} />
        <span className={`${styles.view} ${styles.angleA}`} />
        <span className={`${styles.view} ${styles.edge}`} />
        <span className={`${styles.view} ${styles.angleB}`} />
        <span className={`${styles.view} ${styles.faceB}`} />
      </span>
    </span>
  );
}

export default function PawTokenBurst({ active, x, y }: Props) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const sequence = useRef(0);

  useEffect(() => {
    if (!active) return;

    let timer: number | undefined;
    let stopped = false;

    const emit = (count: number) => {
      const additions = Array.from({ length: count }, () =>
        createParticle(sequence.current++, x, y),
      );
      setParticles((current) =>
        [...current, ...additions].slice(-MAX_PARTICLES),
      );
    };

    const schedule = () => {
      timer = window.setTimeout(() => {
        if (stopped) return;
        emit(sequence.current % 5 === 0 ? 2 : 1);
        schedule();
      }, between(85, 165));
    };

    emit(4);
    schedule();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [active, x, y]);

  const removeParticle = useCallback((id: number) => {
    setParticles((current) => current.filter((particle) => particle.id !== id));
  }, []);

  return (
    <span className={styles.layer} aria-hidden>
      {particles.map((particle) => (
        <PawParticle
          particle={particle}
          onComplete={removeParticle}
          key={particle.id}
        />
      ))}
    </span>
  );
}
