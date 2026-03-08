import Bottleneck from 'bottleneck';

export const apiLimiter = new Bottleneck({
	maxConcurrent: 4,
	minTime: 100,
});
