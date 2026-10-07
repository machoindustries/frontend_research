const step = document.querySelectorAll('.questionnaire__step');
const stepBtn = document.querySelectorAll('.questionnaire__button');
const prevBtn = document.querySelectorAll('.questionnaire__button--back');

for (let i = 0; i < step.length; i++) {
	// create step progress bar "dots"
	let stepDot = document.createElement("div");
	const stepProgress = document.querySelector('.questionnaire__progress');

	stepProgress.appendChild(stepDot);

	// show / hide 'steps'
	step[0].classList.add('show');

	if (i < step.length - 1) {
		stepBtn[i].setAttribute('aria-label', 'Next Question');
		stepBtn[i].addEventListener('click', function () {
			step[i].classList.remove('show');
			step[i + 1].classList.add('show');
			stepDot.classList.add('completed');
		});
		prevBtn[i].addEventListener('click', function () {
			step[i + 1].classList.remove('show');
			step[i].classList.add('show');
			stepDot.classList.remove('completed');
		});
	}

	// target button to submit data
	if (i == step.length - 1) {
		stepBtn[i].setAttribute('id', 'submit');
		stepBtn[i].setAttribute('aria-label', 'Submit Form');
	}
}

// step "dots" indicators
const generatedDots = document.querySelectorAll('.questionnaire__progress div');
generatedDots[0].classList.add('current');

let currentDotIndex = 0;
let completedDotIndex = 1;

stepBtn.forEach((button) => {
	button.addEventListener('click', function () {
		if (completedDotIndex < generatedDots.length) {
			generatedDots[completedDotIndex++].classList.add('current');
		}
	});
});

prevBtn.forEach((button) => {
	button.setAttribute('aria-label', 'Previous Question');
	button.addEventListener('click', function () {
		generatedDots[completedDotIndex - 1].classList.remove('current');
		completedDotIndex--;
		currentDotIndex--;
	});
});

// question numbers
step.forEach((step, index) => {
	const questionNumber = step.querySelector('.questionnaire__question-number');
	questionNumber.textContent = `${index + 1}.`;
});


// disable checkboxes for each answer set if one is selected
const answers = document.querySelectorAll('.questionnaire__answers');

answers.forEach((answer) => {
	const checkboxes = answer.querySelectorAll('input[type="checkbox"]');
	const maxAnswers = answer.getAttribute('data-answers-number');
	const optionalAnswers = answer.getAttribute('data-optional-answers');
	const btnPrev = document.querySelector('.questionnaire__button--back');
	const btnNext = answer.querySelector('.questionnaire__button'); // next/finish button corresponding to the question/answer(s)

	// enable button if optional
	if (optionalAnswers === "True") {
		btnNext.classList.remove('d-none');
	}

	// disable checkboxes based on max answers
	checkboxes.forEach((checkbox) => {
		if (maxAnswers > 0) {
			checkbox.addEventListener('change', () => {
				const checkedCount = answer.querySelectorAll('input[type="checkbox"]:checked').length;

				// only require 1 answer
				checkedCount > 0 ? btnNext.classList.remove('d-none') : btnNext.classList.add('d-none');

				// disable after max answer is reached
				if (checkedCount >= maxAnswers) {
					checkboxes.forEach((cb) => {
						if (!cb.checked) {
							cb.disabled = true;
						}
					});
				}
				else {
					checkboxes.forEach((cb) => {
						cb.disabled = false;
					});
				}
			});
		}
	});

	// 'accessibly' enable/disable checkboxes
	answer.querySelectorAll('label').forEach((label) => {
		label.addEventListener('keydown', function (event) {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				const checkboxId = this.getAttribute('for');
				const checkbox = document.getElementById(checkboxId);
				if (!checkbox.disabled) {
					if (checkbox) {
						checkbox.checked = !checkbox.checked;
					}
				}
			}
		});
	});

});

$('#submit').on('click', function (e) {
	e.preventDefault();

	const $submitButton = $(this);

	// Check if already processing (prevent double clicks)
	if ($submitButton.hasClass('disabled')) {
		return;
	}

	// Find the parent container and the back button
	const $parentBlock = $submitButton.closest('.questionnaire__answers');
	const $backButton = $parentBlock.find('.questionnaire__button--back');
	// Store the original button texts
	const originalSubmitText = $submitButton.html();
	const originalBackText = $backButton.html();

	$('.questionnaire__form--submit-warning').toggleClass("d-none");

	// Disable both buttons
	disableButton($submitButton, '<span class="spinner-border spinner-border-sm text-white" role="status" aria-hidden="true"></span> Processing...');
	disableButton($backButton);

	const formData = new FormData(document.getElementById('questionnaire__form'));
	const data = Object.fromEntries(formData);
	const questionnaires = [];
	const pageId = $('#questionnaire__form').data('page-id');
	const notSelectedQuestionnaires = {};

	for (const [key, value] of Object.entries(data)) {
		if (key.startsWith('questionnaire-')) {
			const [prefix, questionnaireId, , answerId] = key.split('-').map(Number);
			let questionnaire = questionnaires.find((q) => {return q.QuestionnaireBlockId === questionnaireId;});
			if (!questionnaire) {
				questionnaire = { QuestionnaireBlockId: questionnaireId, Answers: [] };
				questionnaires.push(questionnaire);
			}
			if (!isNaN(answerId)) {
				questionnaire.Answers.push(answerId);
			}
		}
	}

	// Collect all available questionnaire IDs
	const allQuestionnaireIds = new Set();
	const allInputs = document.querySelectorAll('#questionnaire__form input[type="checkbox"]');

	allInputs.forEach((input) => {
		const inputName = input.name;
		if (inputName && inputName.startsWith('questionnaire-')) {
			const [prefix, questionnaireId, , answerId] = inputName.split('-').map(Number);
			let questionnaire = questionnaires.find((q) => {return q.QuestionnaireBlockId === questionnaireId;});
			if (!notSelectedQuestionnaires[questionnaireId]) {
				notSelectedQuestionnaires[questionnaireId] = [];
			}
			if (!questionnaire) {
				notSelectedQuestionnaires[questionnaireId].push(answerId);
			} else if (questionnaire) {
				const selectedAnswers = questionnaire.Answers;
				if (!selectedAnswers.includes(answerId)) {
					notSelectedQuestionnaires[questionnaireId].push(answerId);
				}
			}

		}
	});

	// Get selected IDs from existing questionnaires array
	const selectedQuestionnaireIds = new Set(
		questionnaires.map((q) => {return q.QuestionnaireBlockId;})
	);

	// Calculate NOT selected
	const notSelectedQuestionnaireIds = [...allQuestionnaireIds].filter(
		(id) => {return !selectedQuestionnaireIds.has(id);}
	);

	// Build NOT selected questionnaires array
	//const notSelectedQuestionnaires = notSelectedQuestionnaireIds.map(id => ({
	//	QuestionnaireBlockId: id,
	//	Answers: []
	//}));

	console.log("questionnaires", questionnaires);

	console.log("notSelectedQuestionnaires", notSelectedQuestionnaires);

	const requestData = {
		QuestionnairePageId: pageId,
		Questionnaire: questionnaires
	};

	$.ajax({
		url: '/api/questionnaire/',
		type: 'POST',
		contentType: 'application/json',
		data: JSON.stringify(requestData),
		async success (response) {
			// Step 2: Unassign visitor groups (if any)
			if (response.audiencesToUnassign && response.audiencesToUnassign.length > 0) {
				console.log('[VisitorGroups] Unassigning...');
				await $.ajax({
					url: '/api/visitorgroups/unassign',
					type: 'POST',
					contentType: 'application/json',
					data: JSON.stringify({ visitorGroups: response.audiencesToUnassign })
				});
				console.log('[VisitorGroups] Unassigned successfully');
			}

			// Step 3: Assign visitor groups (if any)
			if (response.audiencesToAssign && response.audiencesToAssign.length > 0) {
				console.log('[VisitorGroups] Assigning...');
				await $.ajax({
					url: '/api/visitorgroups/assign',
					type: 'POST',
					contentType: 'application/json',
					data: JSON.stringify({ visitorGroups: response.audiencesToAssign })
				});
				console.log('[VisitorGroups] Assigned successfully');
			}
			const redirectUrl = $('#questionnaire__form').data('redirect');
			if (redirectUrl) {
				window.location.href = redirectUrl;
			} else {
				// Restore button states if no redirect
				enableButton($submitButton, originalSubmitText);
				enableButton($backButton, originalBackText);
				$('.questionnaire__form--submit-warning').toggleClass("d-none");
			}
		},
		error (xhr, status, error) {
			// Re-enable both buttons and restore original text
			enableButton($submitButton, originalSubmitText);
			enableButton($backButton, originalBackText);
			$('.questionnaire__form--submit-warning').toggleClass("d-none");
			alert(`Form submission failed: ${ error}`);
		}
	});
});

/**
 * Disables an anchor tag button
 * @param {jQuery} $button - The button element to disable
 * @param {string} [newText] - Optional new text/HTML to display (keeps original if not provided)
 */
function disableButton($button, newText) {
	if ($button.length === 0) {return;}

	$button
		.addClass('disabled')
		.attr('aria-disabled', 'true')
		.css('pointer-events', 'none');

	if (newText) {
		$button.html(newText);
	}
}

/**
 * Enables an anchor tag button
 * @param {jQuery} $button - The button element to enable
 * @param {string} originalText - The original text/HTML to restore
 */
function enableButton($button, originalText) {
	if ($button.length === 0) {return;}

	$button
		.removeClass('disabled')
		.attr('aria-disabled', 'false')
		.css('pointer-events', '')
		.html(originalText);
}

$('#skip-questionnaire').on('click', function (e) {
	e.preventDefault();
	const pageId = $('#questionnaire__form').data('page-id');
	const requestData = {
		QuestionnairePageId: pageId
	};
	$.ajax({
		url: '/api/questionnaire/skip',
		type: 'POST',
		contentType: 'application/json',
		data: JSON.stringify(requestData),
		success () {
			const redirectUrl = $('#skip-questionnaire').data('redirect');
			if (redirectUrl) {
				window.location.href = `${redirectUrl}`;
			}
		},
		error (xhr, status, error) {
			alert('Form submission failed:', error);
		}
	});
});