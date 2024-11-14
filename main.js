const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = (CANVAS_WIDTH / 16) * 9;
const BASE_ADD_DROP_INTERVAL = 2000;
const MIN_ADD_DROP_INTERVAL = 600;
const ADD_DROP_INTERVAL_DECREMENT = 20;
const DROP_SIZE = 112;
const DROP_BASE_SPEED = 0.5;
const DROP_SPEED_INCREMENT = 0.005;
const CHANCE_OF_GOLDEN_DROP = 0.02;
const OPERATORS = ['+', '-', '*', '/'];
const OPERATOR_TO_UNICODE = {
	'+': '\u002B',
	'-': '\u2212',
	'*': '\u00D7',
	'/': '\u00F7'
};

const mainElement = document.querySelector('main');
const scoreElement = mainElement.querySelector('.js-score');
const bestScoreElement = mainElement.querySelector('.js-best-score');
const canvasElement = mainElement.querySelector('canvas');
const inputElement = mainElement.querySelector('input');
const buttonElement = mainElement.querySelector('button');

const ctx = canvasElement.getContext('2d');

let loopAnimationFrame = null;
let addDropInterval = null;
let drops = [];
let currentScore = 0;
let seaLevel = 0.1;

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

					if (hittedDropIds[drop.id]) {
						playSound('drop-pop.mp3');
					} else {
						newDrops.push(drop);
					}
				}

				drops = newDrops;
				currentScore += deletedDropIdsLength;
			} else {
				currentScore = Math.max(0, currentScore - 1);
			}
		} else {
			drops = [];
			currentScore += drops.length;

			playSound('golden-drop-pop.mp3');
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

		if (drop.y > CANVAS_HEIGHT - (CANVAS_HEIGHT * seaLevel)) {
			missedDropIds[drop.id] = true;
		}

		drawDrop(drop);
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
	}
}

function drawDrop(drop) {
	const x = drop.x;
	const y = drop.y;
	const w = drop.w;
	const h = drop.h;
	let fillStyle = '#03a9f4';
	let strokeStyle = '#81d4fa';

	if (drop.is_golden) {
		fillStyle = '#ffeb3b';
		strokeStyle = '#fffde7';
	}

	ctx.fillStyle = fillStyle;
	ctx.strokeStyle = strokeStyle;
	ctx.lineWidth = 6;

	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.bezierCurveTo(x + w, y + h, x - w, y + h, x, y);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = 'black';
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

	ctx.fillStyle = '#03a9f4';

	ctx.fillRect(0, CANVAS_HEIGHT - h, CANVAS_WIDTH, h);
}

function addDrop() {
	const minX = DROP_SIZE / 2;
	const maxX = CANVAS_WIDTH - DROP_SIZE / 2;
	const operator = getRandomOperator();
	const { a, b } = getOperands(operator);
	const speed = DROP_BASE_SPEED + (currentScore * DROP_SPEED_INCREMENT);
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
		is_golden: Math.random() <= CHANCE_OF_GOLDEN_DROP
	};

	drops.push(drop);
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

function playSound(sound) {
	const audio = new Audio(sound);

	audio.addEventListener('canplaythrough', () => {
		audio.play();
	});
}

function stopLoop() {
	if (!loopAnimationFrame) {
		return;
	}

	cancelAnimationFrame(loopAnimationFrame);

	loopAnimationFrame = null;

}

function startAddDropInterval(score = 0) {
	const delay = Math.max(MIN_ADD_DROP_INTERVAL, BASE_ADD_DROP_INTERVAL - (score * ADD_DROP_INTERVAL_DECREMENT));

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
