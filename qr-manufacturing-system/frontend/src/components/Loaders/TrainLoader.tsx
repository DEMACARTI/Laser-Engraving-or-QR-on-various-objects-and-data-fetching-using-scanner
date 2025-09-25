import React from 'react';
import styles from '../../styles/components/TrainLoader.module.css';

interface TrainLoaderProps {
  label?: string;
}

const TrainLoader: React.FC<TrainLoaderProps> = ({ label = 'Processing' }) => {
  return (
    <div className={styles.wrapper} aria-label={label} role="status">
      <div className={styles.track}>
        <div className={styles.train}>
          <div className={styles.engine} />
          <div className={styles.car} />
          <div className={styles.car} />
        </div>
      </div>
      <div className={styles.caption}>{label}…</div>
    </div>
  );
};

export default TrainLoader;
