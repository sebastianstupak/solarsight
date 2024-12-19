#!/bin/bash

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to prompt user for installation
prompt_install() {
    local tool=$1
    read -p "$tool is not installed. Do you want to install it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

# Function to install gcloud
install_gcloud() {
    echo "Installing gcloud..."
    # Add the Cloud SDK distribution URI as a package source
    echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
    # Import the Google Cloud public key
    curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -
    # Update and install the Cloud SDK
    sudo apt-get update && sudo apt-get install google-cloud-sdk
}

# Function to install jq
install_jq() {
    echo "Installing jq..."
    sudo apt-get update && sudo apt-get install -y jq
}

# Function to check if gcloud beta is installed
check_gcloud_beta() {
    gcloud components list --format="value(id)" | grep -q "^beta$"
}

# Check and install gcloud
if ! command_exists gcloud; then
    if prompt_install "gcloud"; then
        install_gcloud
    else
        echo "gcloud is required for this script. Exiting."
        exit 1
    fi
fi

# Check and install gcloud beta component
if ! check_gcloud_beta; then
    if prompt_install "gcloud beta component"; then
        gcloud components install beta
    else
        echo "gcloud beta component is required for this script. Exiting."
        exit 1
    fi
fi

# Check and install jq
if ! command_exists jq; then
    if prompt_install "jq"; then
        install_jq
    else
        echo "jq is required for this script. Exiting."
        exit 1
    fi
fi

# Check if required arguments are provided
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <project_name> <api_key_name>"
    exit 1
fi

# Assign arguments to variables
PROJECT_NAME="$1"
API_KEY_NAME="$2"

# Generate a project ID from the project name
PROJECT_ID=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')

# Function to check if gcloud is authenticated
check_gcloud_auth() {
    if gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q '@'; then
        return 0
    else
        return 1
    fi
}

# Login to Google Cloud
if ! check_gcloud_auth; then
    echo "You need to authenticate with Google Cloud."
    echo "Please visit the URL that will be provided and authenticate."
    gcloud auth login --no-launch-browser
    if ! check_gcloud_auth; then
        echo "Authentication failed. Please try running 'gcloud auth login' manually and then run this script again."
        exit 1
    fi
fi
echo "Authenticated successfully."

# Check if project exists
if gcloud projects describe "$PROJECT_ID" &>/dev/null; then
    echo "Project $PROJECT_ID already exists. Selecting it."
    gcloud config set project "$PROJECT_ID"
else
    # Create a new project
    echo "Creating new project: $PROJECT_NAME"
    if ! gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME"; then
        echo "Failed to create project. Please check your permissions or try a different project name."
        exit 1
    fi
    # Select the newly created project
    echo "Selecting project: $PROJECT_ID"
    gcloud config set project "$PROJECT_ID"
fi

# Function to check if billing is enabled
check_billing_enabled() {
    gcloud beta billing projects describe "$PROJECT_ID" --format="value(billingEnabled)" 2>/dev/null
}

# Function to list billing accounts
list_billing_accounts() {
    gcloud beta billing accounts list --format="value(name)" 2>/dev/null | head -n 1
}

# Function to enable billing
enable_billing() {
    local billing_account=$1
    gcloud beta billing projects link "$PROJECT_ID" --billing-account="$billing_account"
}

# Check and enable billing
echo "Checking billing status..."
if [[ $(check_billing_enabled) != "True" ]]; then
    echo "Billing is not enabled. Attempting to enable billing..."
    BILLING_ACCOUNT=$(list_billing_accounts)
    if [[ -z "$BILLING_ACCOUNT" ]]; then
        echo "No billing account found. Please set up a billing account and run this script again."
        exit 1
    fi
    if enable_billing "$BILLING_ACCOUNT"; then
        echo "Billing enabled successfully."
    else
        echo "Failed to enable billing. Please enable billing manually and run this script again."
        exit 1
    fi
else
    echo "Billing is already enabled."
fi

# Enable necessary APIs
echo "Enabling required APIs..."
if ! gcloud services enable maps-backend.googleapis.com geocoding-backend.googleapis.com solar.googleapis.com places-backend.googleapis.com; then
    echo "Failed to enable APIs. Please check your permissions or quota limits."
    exit 1
fi

# Check if API key exists
EXISTING_KEY=$(gcloud alpha services api-keys list --filter="displayName:$API_KEY_NAME" --format="value(name)")

if [ -n "$EXISTING_KEY" ]; then
    echo "API key $API_KEY_NAME already exists. Attempting to recreate it."
    gcloud alpha services api-keys delete "$EXISTING_KEY" --quiet
    if [ $? -ne 0 ]; then
        echo "Failed to delete existing API key. Please check your permissions."
        exit 1
    fi
fi

# Create a new API key
echo "Creating API key: $API_KEY_NAME"
API_KEY_OUTPUT=$(gcloud alpha services api-keys create --display-name="$API_KEY_NAME" --format=json)
API_KEY=$(echo "$API_KEY_OUTPUT" | jq -r '.response.keyString // .keyString')

if [ -z "$API_KEY" ] || [ "$API_KEY" == "null" ]; then
    echo "Failed to extract API key. Full output:"
    echo "$API_KEY_OUTPUT"
    exit 1
fi

echo "Setup completed successfully!"
echo "Project ID: $PROJECT_ID"
echo "API Key: $API_KEY"
echo "Please save your API key securely. It won't be displayed again."
echo "The following APIs have been enabled: Maps, Geocoding, Solar, and Places."