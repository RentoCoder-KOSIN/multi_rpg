import { JOBS } from '../data/jobs.js';

// 職業IDを表示名にする。未転職('none')・未知のIDは「初心者」。
export function getJobLabel(jobId) {
    return JOBS[jobId]?.name || '初心者';
}
