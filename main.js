const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = (CANVAS_WIDTH / 16) * 9;
const BASE_ADD_DROP_INTERVAL = 2000;
const MIN_ADD_DROP_INTERVAL = 500;
const ADD_DROP_INTERVAL_DECREMENT = 20;
const DROP_SIZE = 112;
const DROP_BASE_SPEED = 0.5;
const DROP_SPEED_INCREMENT = 0.005;
const GOLDEN_DROP_CHANCE = 0.2;
const POINTS_PER_HITTED_DROP = 50;
const POINTS_PER_MISSED_DROP = 75;
const OPERATORS = ['+', '-', '*', '/'];
const OPERATOR_TO_UNICODE = {
	'+': '\u002B',
	'-': '\u2212',
	'*': '\u00D7',
	'/': '\u00F7'
};

const mainElement = document.querySelector('main');
const scoreElement = document.querySelector('.js-score');
const bestScoreElement = document.querySelector('.js-best-score');
const containerElement = document.querySelector('.js-container');
const canvasElement = document.querySelector('canvas');
const inputElement = document.querySelector('input');
const buttonElement = document.querySelector('button');

const ctx = canvasElement.getContext('2d');

let loopAnimationFrame = null;
let addDropInterval = null;
let drops = [];
let currentScore = 0;
let seaLevel = 0.1;
let dropsCount = 0;
let hittedDropsCount = 0;
let missedDropsCount = 0;

document.addEventListener('DOMContentLoaded', () => {
	mainElement.hidden = false;
	bestScoreElement.textContent = getBestScore();

	prepareCanvas();
	addDrop();
	loop();
	startAddDropInterval();

	inputElement.addEventListener('keydown', handleInputKeydown);
	buttonElement.addEventListener('click', handleButtonClick);
});

function handleInputKeydown(ev) {
	const value = ev.target.value.trim();

	if (!value) {
		return;
	}

	const code = ev.code;

	if (code === 'Enter' || code === 'NumpadEnter') {
		ev.target.value = '';

		const numericValue = Number(value);

		if (Number.isNaN(numericValue)) {
			return;
		}

		const hittedDropIds = {};
		let isHittedGoldenDrop = false;

		for (let i = 0; i < drops.length; i++) {
			const drop = drops[i];

			if (drop.result === numericValue) {
				if (!drop.is_golden) {
					hittedDropIds[drop.id] = true;
				} else {
					isHittedGoldenDrop = true;

					break;
				}
			}
		}

		if (!isHittedGoldenDrop) {
			const deletedDropIdsLength = Object.keys(hittedDropIds).length;

			if (deletedDropIdsLength > 0) {
				const newDrops = [];

				for (let i = 0; i < drops.length; i++) {
					const drop = drops[i];

					if (!hittedDropIds[drop.id]) {
						newDrops.push(drop);
					}
				}

				drops = newDrops;
				currentScore += deletedDropIdsLength * POINTS_PER_HITTED_DROP;
				hittedDropsCount += deletedDropIdsLength;
			} else {
				currentScore = Math.max(0, currentScore - POINTS_PER_MISSED_DROP);
				missedDropsCount++;
			}
		} else {
			currentScore += drops.length * POINTS_PER_HITTED_DROP;
			hittedDropsCount += drops.length;
			drops = [];
		}

		scoreElement.textContent = currentScore;

		stopAddDropInterval();
		startAddDropInterval(currentScore);
	}
}

function handleButtonClick() {
	stopLoop();
	stopAddDropInterval();

	drops = [];
	currentScore = 0;
	seaLevel = 0.1;
	dropsCount = 0;
	hittedDropsCount = 0;

	document.querySelector('table')?.remove();
	scoreElement.textContent = currentScore;
	inputElement.hidden = false;
	inputElement.value = '';
	inputElement.focus();

	addDrop();
	loop();
	startAddDropInterval();
}

function prepareCanvas() {
	const dpr = Math.max(window.devicePixelRatio, 1) || 1;

	canvasElement.width = CANVAS_WIDTH * dpr;
	canvasElement.height = CANVAS_HEIGHT * dpr;

	canvasElement.style.width = `${CANVAS_WIDTH}px`;
	canvasElement.style.height = `${CANVAS_HEIGHT}px`;

	ctx.scale(dpr, dpr);
}

function loop() {
	ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

	const missedDropIds = {};

	for (let i = 0; i < drops.length; i++) {
		const drop = drops[i];

		drop.y += drop.speed;

		drawDrop(drop);

		if (drop.y > CANVAS_HEIGHT - (CANVAS_HEIGHT * seaLevel)) {
			missedDropIds[drop.id] = true;
		}
	}

	let shouldEnd = false;

	if (Object.keys(missedDropIds).length > 0) {
		seaLevel = Math.round((seaLevel + 0.1) * 10) / 10;

		if (seaLevel !== 1) {
			drops = drops.filter(({ id, y }) => !missedDropIds[id] && y <= CANVAS_HEIGHT - (CANVAS_HEIGHT * seaLevel));
		} else {
			shouldEnd = true;
		}
	}

	drawSea();

	if (!shouldEnd) {
		loopAnimationFrame = requestAnimationFrame(loop);
	} else {
		inputElement.hidden = true;

		stopLoop();
		stopAddDropInterval();

		const currentBestScore = getBestScore();

		if (currentScore > currentBestScore) {
			localStorage.setItem('best-score', currentScore);

			bestScoreElement.textContent = currentScore;
		}

		showSummary();
	}
}

function drawDrop(drop) {
	const x = drop.x;
	const y = drop.y;
	const w = drop.w;
	const h = drop.h;
	let fillStyle = '#00bcd4';

	if (drop.is_golden) {
		fillStyle = '#ffeb3b';
	}

	ctx.fillStyle = fillStyle;
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 4;

	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.bezierCurveTo(x + w, y + h, x - w, y + h, x, y);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#333';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = '20px Arial';

	ctx.fillText(drop.a, x + 3, y + 32);
	ctx.fillText(drop.b, x + 3, y + 64);

	ctx.font = '32px Arial';

	ctx.fillText(OPERATOR_TO_UNICODE[drop.operator], x - 16, y + 48);
}

function drawSea() {
	const h = CANVAS_HEIGHT * seaLevel;

	ctx.fillStyle = '#00bcd4';

	ctx.fillRect(0, CANVAS_HEIGHT - h, CANVAS_WIDTH, h);
}

function addDrop() {
	const minX = DROP_SIZE / 2;
	const maxX = CANVAS_WIDTH - DROP_SIZE / 2;
	const operator = getRandomOperator();
	const { a, b } = getOperands(operator);
	const speed = DROP_BASE_SPEED + (dropsCount * DROP_SPEED_INCREMENT);
	const drop = {
		id: Date.now(),
		x: getRandomInt(minX, maxX),
		y: -DROP_SIZE,
		w: DROP_SIZE,
		h: DROP_SIZE,
		speed: getRandomFloat(speed, speed + speed),
		a,
		b,
		operator,
		result: calculateResult(a, b, operator),
		is_golden: Math.random() <= GOLDEN_DROP_CHANCE
	};

	drops.push(drop);

	dropsCount++;
}

function getOperands(operator) {
	const maxOperand = getMaxOperand(operator);
	let a = null;
	let b = getRandomInt(1, maxOperand);

	if (operator === '/') {
		a = b * getRandomInt(1, maxOperand);
	} else {
		a = getRandomInt(1, maxOperand);

		if (operator === '-' && a < b) {
			[a, b] = [b, a];
		}
	}

	return {
		a,
		b
	};
}

function getMaxOperand(operator) {
	if (operator === '*' || operator === '/') {
		return 10;
	}

	return 20;
}

function calculateResult(a, b, operator) {
	if (operator === '-') {
		return a - b;
	} else if (operator === '*') {
		return a * b;
	} else if (operator === '/') {
		return a / b;
	}

	return a + b;
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max) {
	return Math.random() * (max - min) + min;
}

function getRandomOperator() {
	return OPERATORS[Math.floor(Math.random() * OPERATORS.length)];
}

function stopLoop() {
	if (!loopAnimationFrame) {
		return;
	}

	cancelAnimationFrame(loopAnimationFrame);

	loopAnimationFrame = null;

}

function startAddDropInterval() {
	const delay = Math.max(MIN_ADD_DROP_INTERVAL, BASE_ADD_DROP_INTERVAL - (dropsCount * ADD_DROP_INTERVAL_DECREMENT));

	addDropInterval = setInterval(addDrop, delay);
}

function stopAddDropInterval() {
	if (!addDropInterval) {
		return;
	}

	clearInterval(addDropInterval);

	addDropInterval = null;
}

function getBestScore() {
	const currentBestScore = localStorage.getItem('best-score');

	if (!currentBestScore) {
		return 0;
	}

	const numericBestScore = Number(currentBestScore);

	if (Number.isNaN(numericBestScore)) {
		return 0;
	}

	return numericBestScore;
}

function showSummary() {
	const accuracy = (hittedDropsCount / (hittedDropsCount + missedDropsCount)) * 100;

	containerElement.insertAdjacentHTML('beforeend', `
		<table>
			<tbody>
				<tr>
					<td>Score</td>
					<td>
						<strong>${currentScore}</strong>
					</td>
				</tr>
				<tr>
					<td>Correct</td>
					<td>
						<strong>${hittedDropsCount}</strong>
					</td>
				</tr>
				<tr>
					<td>Accuracy</td>
					<td>
						<strong>${accuracy ? accuracy.toFixed(2) : 0}%</strong>
					</td>
				</tr>
			</tbody>
		</table>
	`);
}
