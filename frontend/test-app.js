// Test mode configuration
const API_BASE_URL = window.location.origin;

// State management
let formData = {
    photo: null,
    photoBase64: null,
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    organization: '',
    sessionId: null
};

// DOM Elements
const form = document.getElementById('rsvp-form');
const photoInput = document.getElementById('photo');
const photoPreview = document.getElementById('photo-preview');
const uploadPhotoBtn = document.getElementById('upload-photo-btn');
const cameraPhotoBtn = document.getElementById('camera-photo-btn');
const submitBtn = document.getElementById('submit-btn');
const captchaSection = document.getElementById('captcha-section');
const captchaImage = document.getElementById('captcha-image');
const captchaAnswer = document.getElementById('captcha-answer');
const backBtn = document.getElementById('back-btn');
const finalSubmitBtn = document.getElementById('final-submit-btn');
const successSection = document.getElementById('success-section');
const messageDiv = document.getElementById('message');

// Load dummy photo from resource folder
function loadDummyPhoto() {
    fetch('../resource/photo.jpg')
        .then(response => response.blob())
        .then(blob => {
            const reader = new FileReader();
            reader.onload = (event) => {
                formData.photoBase64 = event.target.result;
                photoPreview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
                photoPreview.classList.add('has-image');
                showMessage('Demo photo loaded successfully!', 'success');
            };
            reader.readAsDataURL(blob);
        })
        .catch(error => {
            console.error('Error loading demo photo:', error);
            showMessage('Could not load demo photo. Please upload your own.', 'error');
        });
}

// Photo upload handlers
uploadPhotoBtn.addEventListener('click', () => {
    photoInput.removeAttribute('capture');
    photoInput.click();
});

cameraPhotoBtn.addEventListener('click', () => {
    photoInput.setAttribute('capture', 'user');
    photoInput.click();
});

// Photo preview handler
photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            showMessage('Please select an image file', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showMessage('Image size must be less than 5MB', 'error');
            return;
        }

        formData.photo = file;

        const reader = new FileReader();
        reader.onload = (event) => {
            formData.photoBase64 = event.target.result;
            photoPreview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
            photoPreview.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    }
});

photoPreview.addEventListener('click', () => {
    uploadPhotoBtn.click();
});

// Step 1: Initial form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    formData.firstName = document.getElementById('firstName').value.trim();
    formData.lastName = document.getElementById('lastName').value.trim();
    formData.phone = document.getElementById('phone').value.trim();
    formData.email = document.getElementById('email').value.trim();
    formData.organization = document.getElementById('organization').value.trim();

    if (!formData.photoBase64) {
        showMessage('Please upload your photo', 'error');
        return;
    }

    if (!formData.firstName || !formData.lastName || !formData.phone || !formData.email || !formData.organization) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }

    if (!isValidEmail(formData.email)) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }

    await submitStep1();
});

// Submit step 1 - Get captcha (CALLS REAL BACKEND)
async function submitStep1() {
    try {
        setLoadingState(submitBtn, true);
        hideMessage();

        console.log('Submitting step 1 - calling backend API...');

        const response = await fetch(`${API_BASE_URL}/api/init-rsvp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
                email: formData.email,
                organization: formData.organization,
                photo: formData.photoBase64
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Store session ID
            formData.sessionId = result.sessionId;

            // Show real captcha from backend
            if (result.captchaImage) {
                captchaImage.src = result.captchaImage;

                // Hide form, show captcha section
                form.style.display = 'none';
                captchaSection.style.display = 'block';
                captchaAnswer.focus();

                showMessage('Please solve the captcha to complete registration', 'info');
            } else {
                throw new Error('No captcha received from server');
            }
        } else {
            throw new Error(result.error || 'Failed to initialize RSVP');
        }
    } catch (error) {
        console.error('Step 1 error:', error);
        showMessage(`Error: ${error.message}. Make sure backend server is running.`, 'error');
    } finally {
        setLoadingState(submitBtn, false);
    }
}

// Back button handler
backBtn.addEventListener('click', () => {
    captchaSection.style.display = 'none';
    form.style.display = 'block';
    captchaAnswer.value = '';
    hideMessage();
});

// Final submit with captcha
finalSubmitBtn.addEventListener('click', async () => {
    const answer = captchaAnswer.value.trim();

    if (!answer) {
        showMessage('Please enter the captcha answer', 'error');
        return;
    }

    await submitStep2(answer);
});

// Submit step 2 - Complete with captcha (CALLS REAL BACKEND)
async function submitStep2(captchaAnswerValue) {
    try {
        setLoadingState(finalSubmitBtn, true);
        hideMessage();

        console.log('Submitting step 2 - calling backend API...');

        const response = await fetch(`${API_BASE_URL}/api/complete-rsvp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: formData.sessionId,
                captchaAnswer: captchaAnswerValue
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Show success
            showSuccess(result.data);
        } else {
            throw new Error(result.error || 'Failed to complete RSVP');
        }
    } catch (error) {
        console.error('Step 2 error:', error);
        showMessage(`Error: ${error.message}. Please check your captcha answer.`, 'error');
    } finally {
        setLoadingState(finalSubmitBtn, false);
    }
}

// Show success message
function showSuccess(data) {
    captchaSection.style.display = 'none';
    successSection.style.display = 'block';

    const successDetails = document.getElementById('success-details');
    successDetails.innerHTML = `
        <p><strong>Name:</strong> ${formData.firstName} ${formData.lastName}</p>
        <p><strong>Email:</strong> ${formData.email}</p>
        <p><strong>Phone:</strong> ${formData.phone}</p>
        <p><strong>Organization:</strong> ${formData.organization}</p>
        <p><strong>Event Dates:</strong> November 7-8, 2025</p>
        ${data.confirmationMessage ? `<p style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;"><em>${data.confirmationMessage}</em></p>` : ''}
    `;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show message to user
function showMessage(text, type = 'info') {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            hideMessage();
        }, 5000);
    }

    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Hide message
function hideMessage() {
    messageDiv.style.display = 'none';
}

// Set loading state for buttons
function setLoadingState(button, loading) {
    const btnText = button.querySelector('.btn-text');
    const btnLoader = button.querySelector('.btn-loader');

    if (loading) {
        button.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
    } else {
        button.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Test control functions
function showCaptchaStep() {
    showMessage('Use the form to submit and get the real captcha from backend', 'info');
}

function showSuccessStep() {
    if (!formData.photoBase64) {
        loadDummyPhoto();
    }

    formData.firstName = document.getElementById('firstName').value || 'John';
    formData.lastName = document.getElementById('lastName').value || 'Doe';
    formData.phone = document.getElementById('phone').value || '+94 77 123 4567';
    formData.email = document.getElementById('email').value || 'john.doe@example.com';
    formData.organization = document.getElementById('organization').value || 'Tech Solutions Ltd';

    showSuccess({
        confirmationMessage: 'Your registration has been processed successfully. You will receive a confirmation email shortly.'
    });
}

function resetForm() {
    location.reload();
}

// Initialize on page load
window.addEventListener('load', () => {
    console.log('Test mode loaded - Backend integration enabled');
    showMessage('Visual test mode active. Make sure backend is running (npm start). Click "Load Dummy Photo" to begin.', 'info');
});
