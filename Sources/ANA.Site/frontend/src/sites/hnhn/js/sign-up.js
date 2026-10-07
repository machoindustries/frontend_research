'use strict';

// Sign Up Form
const signUpForm = document.querySelector('.sign-up__form form');
let signUpfields = signUpForm.querySelectorAll('input, select');
signUpForm.setAttribute('novalidate', '');
const submitBtn = document.querySelector('input[name="create_account"]');

// Steps
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
step2.classList.add('d-none');

// Go Back Step
function goBack() {
    step2.classList.add('d-none');
    step1.classList.remove('d-none');
}

// Next Button / Style / Add Parent
const nextBtn = document.createElement('button');
nextBtn.textContent = "Next";
nextBtn.setAttribute('type', 'button');
nextBtn.classList.add('btn', 'btn-primary');
const nextWrap = document.createElement("div");
nextWrap.classList.add('text-center', 'mt-4', 'sign-up__next');
nextWrap.appendChild(nextBtn);
step1.appendChild(nextWrap);

// Back Button / Style / Add Parent
const backBtn = document.createElement('button');
backBtn.textContent = "Back";
backBtn.setAttribute('type', 'button');
backBtn.classList.add('btn', 'btn-secondary');
const buttonWrap = document.createElement("div");
buttonWrap.classList.add('text-center', 'mt-4', 'sign-up__buttons');
buttonWrap.appendChild(backBtn);
buttonWrap.appendChild(submitBtn);
step2.appendChild(buttonWrap);
const signUpButtons = document.querySelector('.sign-up__buttons');

// Spinner
let spinner = document.createElement('div');
spinner.classList.add('sign-up__spinner', 'd-none');
spinner.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
buttonWrap.after(spinner);

function spinnerInit() {
    signUpButtons.classList.remove('d-none');
    spinner.classList.add('d-none');
}

// Unknown Error
let randomError = document.createElement('div');
randomError.classList.add('sign-up__random-error', 'form-error', 'd-none');
randomError.textContent = "An Unknown Error Occured.";
spinner.after(randomError);

// City Error
const cityField = document.querySelector('input[name="city"]');
let cityError = cityField.nextElementSibling;

// Zip Code
const zipField = document.querySelector('input[name="postal_code"]');
let zipError = zipField.nextElementSibling;

// State / Country Required
const countryField = document.querySelector('select[name="country"]');
const stateField = document.querySelector('select[name="state"]');
countryField.setAttribute('required', 'required');
stateField.setAttribute('required', 'required');
countryField.value = "USA";

// Step Fields
let step1Fields;
let step2Fields;

let declareSteps = () => {
    step1Fields = document.querySelectorAll('#step1 input[required], #step1 select[required]');
    step2Fields = document.querySelectorAll('#step2 input[required], #step2 select[required]');
};

declareSteps();

// Create Error Fields
signUpfields.forEach((field) => {
    let error = document.createElement('div');
    error.classList.add('form-error', 'd-none');
    if (field.type === "checkbox") {
        error.classList.add('checkbox-error');
        let label = field.nextElementSibling;
        label.after(error);
    }
    else {
        field.after(error);
    }
});

// Required Field Validation
const checkBox = document.querySelectorAll('input[type="checkbox"]');

function fieldValidation(fields) {
    let isValid = true;
    fields.forEach((field) => {
        let error;
        let fieldName;
        if (field.type === "checkbox") {
            error = field.nextElementSibling.nextElementSibling;
            fieldName = field.getAttribute('placeholder');
        }
        else {
            error = field.nextElementSibling;
            fieldName = field.getAttribute('placeholder');
        }
        if (!field.value.trim() || field.type === "checkbox" && !field.checked) {
            error.classList.remove('d-none');
            error.textContent = `${fieldName} is required`;
            isValid = false;
        }
        else {
            error.classList.add('d-none');
            error.textContent = '';
        }
    });
    return isValid;
}

function removeRequired(field) {
    field.required = false;
    field.classList.add('d-none');
    field.nextElementSibling.classList.add('d-none');
    field.nextElementSibling.textContent = '';
}

function addRequired(field) {
    field.required = true;
    field.classList.remove('d-none');
}

countryField.addEventListener('input', () => {

    if (countryField.value !== 'USA') {
        removeRequired(stateField);
        declareSteps();
    }
    else {
        addRequired(stateField);
        declareSteps();
    }
});

// Email Validation
const emailField = document.querySelector('input[type="email"]');

function emailValidation(emailField) {
    let isValid = true;
    let emailValue = emailField.value.trim();
    let emailError = emailField.nextElementSibling;
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    let validEmail = regex.test(emailValue);

    if (!validEmail) {
        emailError.classList.remove('d-none');
        emailError.textContent = `Email is not in a valid format`;
        isValid = false;
    }
    else {
        emailError.classList.add('d-none');
        emailError.textContent = '';
    }
    return isValid;
}

// Validate Password
const enterPassword = document.querySelector('input[name="password"]');
const confirmPassword = document.querySelector('input[name="password_confirm"]');

function passwordValidation(password) {
    let isValid = true;
    let fieldValue = password.value.trim();
    let error = password.nextElementSibling;

    const hasLower = /[a-z]/.test(fieldValue);
    const hasUpper = /[A-Z]/.test(fieldValue);
    const hasDigit = /[0-9]/.test(fieldValue);
    const length = fieldValue.length;

    let validPassword = hasLower && hasUpper && hasDigit && length >= 7;

    if (!validPassword) {
        error.classList.remove('d-none');
        error.textContent =
            `Passwords must contain: at least 1 
            lowercase/uppercase character and a minimum of 7 characters`;
        isValid = false;
    }
    else if (validPassword) {
        error.classList.add('d-none');
        error.textContent = '';
    }
    return isValid;
}

// Password Match
function passwordMatch(password) {
    let isValid = true;
    let fieldValue = password.value.trim();
    let error = password.nextElementSibling;

    let passwordValue = enterPassword.value;

    if (fieldValue !== passwordValue) {
        error.classList.remove('d-none');
        error.textContent = "Passwords do not match";
        isValid = false;
    }
    else if (!passwordValue) {
        error.classList.remove('d-none');
        error.textContent = "Password is required";
        isValid = false;
    }
    else {
        error.classList.add('d-none');
        error.textContent = '';
    }
    return isValid;
}

// Validate Step 1
nextBtn.addEventListener('click', function () {
    if (fieldValidation(step1Fields) & emailValidation(emailField) &
        passwordValidation(enterPassword) & passwordMatch(confirmPassword))
    {
        step1.classList.add('d-none');
        step2.classList.remove('d-none');
    }
    else {
        step1Fields.forEach((field) => {
            field.addEventListener('input', function () {
                fieldValidation(step1Fields);
            });
        });
        emailField.addEventListener('input', function () {
            emailValidation(emailField);
        });
        enterPassword.addEventListener('input', function () {
            passwordValidation(enterPassword);
        });
        confirmPassword.addEventListener('input', function () {
            passwordMatch(confirmPassword);
        });
    }
});

// Go Back
backBtn.addEventListener('click', function () {
    goBack();
});

// US Zip Code Validation
function zipCodeValidation(zipField) {
    let isValid = true;
    if (countryField.value === "USA") {
        zipError = zipField.nextElementSibling;
        let zipValue = zipField.value.trim();
        const regex = /^\d{5}(-\d{4})?$/;
        let validZip = regex.test(zipValue);

        if (!validZip) {
            zipError.classList.remove('d-none');
            zipError.textContent = 'Zip Code is not in a valid format';
            isValid = false;
        }
    }

    return isValid;
}

// ReCaptcha Validation
const recaptcha = document.querySelector('.g-recaptcha');
const recaptchaError = recaptcha.nextElementSibling;

function showRecaptchaError() {
    recaptchaError.classList.remove('d-none');
}
function onRecaptchaSuccess() {
    recaptchaError.classList.add('d-none');
}

// Validate Step 2
signUpForm.addEventListener('submit', function (event) {
    event.preventDefault();

    // ReCaptcha Validation
    const recaptchaResponse = grecaptcha.getResponse();
    if (!recaptchaResponse) {
        showRecaptchaError();
    }
    if (fieldValidation(step1Fields) & fieldValidation(step2Fields) &
        emailValidation(emailField) & passwordValidation(enterPassword) &
        passwordMatch(confirmPassword) & zipCodeValidation(zipField) &
        recaptchaResponse != null & recaptchaResponse != '')
    {
        signUpButtons.classList.add('d-none');
        randomError.classList.add('d-none');
        spinner.classList.remove('d-none');

        const formData = new FormData(event.target);

        const jsonObject = {};
        formData.forEach((value, key) => {
            if (key === "__RequestVerificationToken") {
                return;
            }
            jsonObject[key] = value;
        });
        const pageId = $('.sign-up__form').data('page-id');
        const jsonRequest = {
            signUpPageId: pageId,
            __RequestVerificationToken: jsonObject.__requestverificationtoken,
            formFields: jsonObject
        };
        $.ajax({
            url: '/api/signup',
            type: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify(jsonRequest),
            success (response) {
                if (response) {
                    const redirectUrl = $('.sign-up__form').data('redirect');
                    if (redirectUrl) {
                        window.location.href = response;
                    }
                }
                else {
                    randomError.classList.remove('d-none');
                    randomError.textContent = 'Error occured while signin up new user.';
                }
            },
            error (xhr) {
                console.log(xhr);
                let emailError = emailField.nextElementSibling;
                //let usernameField = document.querySelector('input[name=user_name]');
                //let usernameError = usernameField.nextElementSibling;
                if (xhr.responseJSON.type == 'Email') {
                    emailError.classList.remove('d-none');
                    emailError.textContent = xhr.responseJSON.detail;
                    spinnerInit();
                    goBack();
                }
                //else if (xhr.responseJSON.type == 'UserName') {
                //    usernameError.classList.remove('d-none');
                //    usernameError.textContent = xhr.responseJSON.detail;
                //    spinnerInit();
                //    goBack();
                //}
                else if (xhr.responseJSON.type == 'City') {
                    cityError.classList.remove('d-none');
                    cityError.textContent = xhr.responseJSON.detail;
                    spinnerInit();
                }
                else if (xhr.responseJSON.type == 'Unknown') {
                    spinnerInit();
                    const randomError = document.querySelector('.sign-up__random-error');
                    randomError.classList.remove('d-none');
                }
                else if (xhr.status == 400) {
                    if (xhr.responseJSON && xhr.responseJSON.errors && xhr.responseJSON.errors.errors) {
                        randomError.classList.remove('d-none');
                        randomError.textContent = xhr.responseJSON.errors.errors.join('\n');
                    }                    
                    spinnerInit();
                }
                else {
                    emailError.classList.add('d-none');
                    //usernameError.classList.add('d-none');
                    randomError.classList.add('d-none');
                }
            }
        });
    }
    else {
        step2Fields.forEach((input) => {
            if (input != checkBox) {
                input.addEventListener('input', function () {
                    fieldValidation(step2Fields);
                });
            }
        });
        zipField.addEventListener('input', function () {
            zipCodeValidation(zipField);
        });
    }
});