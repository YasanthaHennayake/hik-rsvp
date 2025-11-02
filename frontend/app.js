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
const refreshCaptchaBtn = document.getElementById('refresh-captcha-btn');
const successSection = document.getElementById('success-section');
const messageDiv = document.getElementById('message');
const loadingOverlay = document.getElementById('loading-overlay');

// Loading messages
const loadingMessages = [
    'Validating security clearance...',
    'Setting up CCTV whitelist...',
    'Adding you to VIP guest list...',
    'Registering biometrics...',
    'Configuring access permissions...',
    'Synchronizing with surveillance system...',
    'Preparing your security profile...',
    'Encrypting your credentials...',
    'Verifying facial recognition data...',
    'Activating smart entry protocol...'
];

let loadingInterval = null;
let currentMessageIndex = 0;

// Loading overlay functions
function showLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';

        // Get the loading text element
        const loadingText = document.querySelector('.loading-text');

        // Start with first message
        currentMessageIndex = 0;
        if (loadingText) {
            loadingText.textContent = loadingMessages[currentMessageIndex];
        }

        // Rotate messages every 2.5 seconds
        loadingInterval = setInterval(() => {
            currentMessageIndex = (currentMessageIndex + 1) % loadingMessages.length;
            if (loadingText) {
                // Add fade effect
                loadingText.style.opacity = '0';
                setTimeout(() => {
                    loadingText.textContent = loadingMessages[currentMessageIndex];
                    loadingText.style.opacity = '1';
                }, 300);
            }
        }, 2500);
    }
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';

        // Clear the interval
        if (loadingInterval) {
            clearInterval(loadingInterval);
            loadingInterval = null;
        }
    }
}

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
        showLoading();
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
        hideLoading();
    }
}

// Back button handler
backBtn.addEventListener('click', () => {
    captchaSection.style.display = 'none';
    form.style.display = 'block';
    captchaAnswer.value = '';
    hideMessage();
});

// Refresh captcha button handler
refreshCaptchaBtn.addEventListener('click', async () => {
    captchaAnswer.value = '';
    await refreshCaptcha();
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
        showLoading();
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

        // Check if it's a captcha error
        if (error.message.includes('Invalid verification code') ||
            error.message.includes('captcha') ||
            error.message.includes('SYS[211]')) {

            showMessage('Invalid captcha. Refreshing captcha image...', 'error');

            // Clear the captcha input
            captchaAnswer.value = '';

            // Get a new captcha by resubmitting step 1
            await refreshCaptcha();
        } else {
            showMessage(`Error: ${error.message}. Please check your captcha answer.`, 'error');
        }
    } finally {
        hideLoading();
    }
}

// Refresh captcha after incorrect answer
async function refreshCaptcha() {
    try {
        showLoading();

        console.log('Refreshing captcha...');

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
            // Update session ID
            formData.sessionId = result.sessionId;

            // Update captcha image
            if (result.captchaImage) {
                captchaImage.src = result.captchaImage;
                captchaAnswer.focus();
                showMessage('New captcha loaded. Please try again.', 'info');
            }
        } else {
            throw new Error(result.error || 'Failed to refresh captcha');
        }
    } catch (error) {
        console.error('Captcha refresh error:', error);
        showMessage(`Error refreshing captcha: ${error.message}. Please go back and try again.`, 'error');
    } finally {
        hideLoading();
    }
}

// Show success message
function showSuccess(data) {
    captchaSection.style.display = 'none';
    successSection.style.display = 'block';

    const successDetails = document.getElementById('success-details');

    let qrCodeHtml = '';
    if (data.qrCode) {
        qrCodeHtml = `
            <div style="text-align: center; margin: 20px 0; padding: 20px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border: 1px solid rgba(147, 51, 234, 0.3); border-radius: 8px;">
                <h3 style="margin-bottom: 15px; color: rgba(255, 255, 255, 0.95); text-shadow: 0 0 20px rgba(147, 51, 234, 0.6);">Save below QR and show it at the registration counter to check in</h3>
                <img src="${data.qrCode}" alt="QR Code" style="max-width: 250px; width: 100%; height: auto; border: 2px solid rgba(147, 51, 234, 0.5); padding: 10px; background: white; border-radius: 8px;">
            </div>
        `;
    }

    let reservationCodeHtml = '';
    if (data.reservationCode) {
        reservationCodeHtml = `
            <div style="text-align: center; margin: 20px 0; padding: 15px; background: #e8f5e9; border-radius: 8px; border: 2px solid #4caf50;">
                <p style="margin: 0; font-size: 14px; color: #666;">Reservation Code</p>
                <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: bold; color: #2e7d32; letter-spacing: 3px;">${data.reservationCode}</p>
            </div>
        `;
    }

    successDetails.innerHTML = `
        ${qrCodeHtml}
        ${reservationCodeHtml}
        <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid rgba(147, 51, 234, 0.3);">
            <p><strong>Name:</strong> ${formData.firstName} ${formData.lastName}</p>
            <p><strong>Email:</strong> ${formData.email}</p>
            <p><strong>Phone:</strong> ${formData.phone}</p>
            <p><strong>Organization:</strong> ${formData.organization}</p>
            <p><strong>Event Date:</strong> November 7, 2025</p>
            ${data.confirmationMessage ? `<p style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(147, 51, 234, 0.3);"><em>${data.confirmationMessage}</em></p>` : ''}
        </div>
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
        confirmationMessage: 'Your registration has been processed successfully.'
    });
}

function resetForm() {
    location.reload();
}

// Initialize on page load
window.addEventListener('load', () => {
    console.log('Application loaded - Backend integration enabled');
});
