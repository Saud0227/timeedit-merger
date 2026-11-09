// Main application script

const mainTile = document.getElementById('main-content');
let categories = []
let out1 = ""
let out1active = false
let out2 = ""
let out2active = false
let editButtonTimers={}
let autoSaveTimers = {}
let autoSaveDelay = 5000 // will be overwritten by the server, default is 5 seconds

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

document.addEventListener('DOMContentLoaded', function () {

    getAllCategories();

    getState((state) => {
        out1 = state.output1_name
        out1active = state.output1_enabled
        out2 = state.output2_name
        out2active = state.output2_enabled
        autoSaveDelay = state.auto_save_delay || 5000;

        if (out1active) {
            const output1a = document.getElementById('output1a');
            output1a.href = state.external_url + state.output1_url;
            output1a.innerText = out1;
        } else {
            const output1a = document.getElementById('output1a');
            output1a.remove();
        }

        if (out2active) {
            const output2a = document.getElementById('output2a');
            output2a.href = state.external_url + state.output2_url;
            output2a.innerText = out2;
        } else {
            const output2a = document.getElementById('output2a');
            output2a.remove();
        }

        // when we know out1 and out2 we can load the current sources
        loadAllCurrentSources();
    })

    // const element = document.getElementById("choices-multiple-remove-button");
    // const multipleCancelButton = new Choices(element, {
    //         allowHTML: true,
    //         removeItemButton: true,
    //       }
    // );
    document.getElementById('new-source-button').addEventListener('click', openPopup);
    document.getElementById('new-source-cancel').addEventListener('click', closePopup);
    document.getElementById('reset-button').addEventListener('click', loadAllCurrentSources);
    document.getElementById('refresh-cache-button').addEventListener('click', refreshCache);
    document.getElementById('new-source-submit').addEventListener('click', createNewSource);
    document.getElementById('new-source-form').addEventListener('input', () => {
        document.getElementById('new-source-submit').disabled = !document.getElementById('new-source-form').checkValidity();
    });
    console.log('Application loaded');
});

function validateJson(data) {

    try {

        fetch('api/dynamic/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data, null, 0)
        })
            .then(response => response.json())
            .then(data => {
                if (data.status !== 'ok') {
                    alert('JSON is valid but was rejected by the server: ' + data.detail);
                }
            })
            .catch(error => {
                alert('Error validating JSON on server: ' + error.message);
            });
    } catch (e) {
        alert('Invalid JSON: ' + e.message);
    }
}
/**
 * Fetches the current JSON from the server and populates the textarea
 */

function getJsonViaApi(api_endpoint, callback) {
    fetch(api_endpoint)
        .then(response => {
            if (response.status !== 200) {
                throw new Error('Failed to fetch JSON from server: ' + response.statusText);
            }
            response.json().then(data => callback(data));
        })
        .catch(error => {
            alert('Error fetching JSON from server: ' + error.message);
            return null;
        });
}

function postJsonViaApi(api_endpoint, data, callback, failedCallback = null) {
    console.log('Posting JSON to server: ' + JSON.stringify(data, null, 0));

    fetch(api_endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data, null, 0)
    })
        .then(response => {
            if (response.status !== 200) {
                if (failedCallback) {
                    response.json().then(data => failedCallback(data));
                } else {
                    throw new Error('Failed to post JSON to server: ' + response.statusText);
                }
            }
            response.json().then(data => callback(data));
        })
        .catch(error => {
            console.error('Error posting JSON to server: ', error);
            alert('Error posting JSON to server: ' + error.message);
        });
}

function loadAllCurrentSources() {
    getJsonViaApi('api/sources', (data) => {
        // get source keys and values from data.sources and create a row for each source
        resetSourceRows();
        console.log(data)
        Object.keys(data).forEach((key, index) => {
            const source = data[key];
            createSourceRow(key, source);
        });
    });
}

function getState(callback) {
    getJsonViaApi('api/status', callback);
}

function getAllCategories() {
    getJsonViaApi('api/categories', (data)=>{
        categories = data.categories;
        categories.push("other");
    });
}

function resetSourceRows() {
    // all children except the first (header row) should be removed
    while (mainTile.children.length > 0) {
        mainTile.removeChild(mainTile.lastChild);
    }
    editButtonTimers = {}; // Reset the edit button timers
}

function openPopup() {
    const popup = document.getElementById('popup-container');
    // remove the bool atribute hidden and set aria-expanded to true
    popup.removeAttribute('hidden');
    popup.setAttribute('aria-expanded', 'true');
}

function closePopup() {
    const popup = document.getElementById('popup-container');
    // set the bool atribute hidden and set aria-expanded to false
    popup.setAttribute('hidden', 'true');
    popup.setAttribute('aria-expanded', 'false');
}

function enableEdit(id) {
    // get name and url input fields and remove the disabled attribute
    const nameInput = document.getElementById(id + '_name');
    const urlInput = document.getElementById(id + '_url');
    nameInput.removeAttribute('disabled');
    urlInput.removeAttribute('disabled');

    clearTimeout(editButtonTimers[id]);

    // change the edit button to a save button
    const editButton = document.getElementById(id + '_edit');

    // hide save state button
    const saveStateButton = document.getElementById(id + '_save_state');
    saveStateButton.classList.add('hidden');

    editButton.onclick = () => submitEdit(id);
    // get the material icon and change it to save
    const materialIcon = editButton.querySelector('.material-symbols-rounded');
    materialIcon.innerText = 'save_as';
}

function setDeleteDialog(id, show) {
    const sourceRowCover = document.getElementById(id + '_cover');
    if (show) {
        sourceRowCover.removeAttribute('hidden');
        sourceRowCover.setAttribute('aria-expanded', 'true');
    } else {
        sourceRowCover.setAttribute('hidden', 'true');
        sourceRowCover.setAttribute('aria-expanded', 'false');
    }
}

function submitEdit(id) {
    const nameInput = document.getElementById(id + '_name');
    const urlInput = document.getElementById(id + '_url');
    const name = nameInput.value;
    const url = urlInput.value;

    // set edit button to be disabled, icon to be a loading spinner
    const editButton = document.getElementById(id + '_edit');
    editButton.setAttribute('disabled', 'true');
    const materialIcon = editButton.querySelector('.material-symbols-rounded');
    materialIcon.innerText = 'autorenew';
    materialIcon.classList.add('spin');




    postJsonViaApi('api/sources/' + id, { name: name, url: url }, (data) => {
        if (data.status === 'ok') {
            // disable the input fields again
            nameInput.setAttribute('disabled', 'true');
            urlInput.setAttribute('disabled', 'true');
            // change the save button back to an edit button
            const editButton = document.getElementById(id + '_edit');
            editButton.onclick = () => enableEdit(id);
            // remove the event listener
            // get the material icon and change it to edit
            const materialIcon = editButton.querySelector('.material-symbols-rounded');
            materialIcon.classList.remove('spin');

            editButton.removeAttribute('disabled');

            // restore the save state button
            const saveStateButton = document.getElementById(id + '_save_state');
            saveStateButton.classList.remove('hidden');

            // set to checkbox for 1 second to show that the save was successful
            materialIcon.innerText = 'check';
            // after 1 second, change it back to edit
            // save timer to editButtonTimers[id] so that we can clear it if the user clicks edit again before the timer is up
            if (editButtonTimers[id]) {
                clearTimeout(editButtonTimers[id]);
            }
            editButtonTimers[id] = setTimeout(() => {
                materialIcon.innerText = 'edit_square';
                editButtonTimers[id] = null;
            }, 2000);
        }
    }, (error) => {
        // if ics could not be loaded, show an alert and do not disable the input fields
        console.log('Error updating source:', error);
        console.log(error.detail)

        if (error && error.detail && error.detail.startsWith("Could not load ICS from")) {
            alert("Could not load ICS from the provided URL. Please check the URL and try again.");
        } else {
            alert('Error updating source: ' + (error.response ? error.response.detail : error.message));
        }
    });

}

function deleteSource(id) {
    // delete to endpoint api/sources/{id} with DELETE method
    fetch('api/sources/' + id, {
        method: 'DELETE'
    })
        .then(response => {
            if (response.status !== 200) {
                throw new Error('Failed to delete source from server: ' + response.statusText);
            }
            // remove the source row from the DOM
            const row = document.getElementById(id);
            row.parentNode.removeChild(row);
            editButtonTimers[id] = null;
        })
        .catch(error => {
            alert('Error deleting source from server: ' + error.message);
        });
}

function createNewSource(event) {

    event.preventDefault();


    const name = document.getElementById('source-name').value;
    const url = document.getElementById('source-url').value;



    postJsonViaApi('api/sources', { name: name, url: url }, (data) => {
        console.log(data);
        if (data.status === 'ok') {
            closePopup();
            const newSource = {
                name: name,
                url: url,
                output1: {
                    enabled: false,
                    allowed: []
                },
                output2: {
                    enabled: false,
                    allowed: []
                }
            };
            createSourceRow(data.res, newSource);
        }
    }, (error) => {
        // get detail from error and show it in an alert
        console.log('Error creating new source:', error);
        console.log(error.detail)

        if (error && error.detail && error.detail.startsWith("Could not load ICS from")) {
            alert("Could not load ICS from the provided URL. Please check the URL and try again.");
        } else {
            alert('Error creating new source: ' + (error.response ? error.response.detail : error.message));
        }
    });
}

function createSourceRow(id, source) {
    const row = document.createElement('div');
    row.classList.add('source-row');
    row.id = id

    const headerDiv = document.createElement('div');
    headerDiv.classList.add('source-header');

    const nameAndSaveStateDiv = document.createElement('div');
    nameAndSaveStateDiv.classList.add('name-and-save-state');

    const name = document.createElement('input')
    name.type = 'text';
    name.value = source.name || '';
    name.placeholder = 'Name...';
    name.id = id + '_name'
    name.setAttribute('disabled', 'true');
    nameAndSaveStateDiv.appendChild(name);

    headerDiv.appendChild(nameAndSaveStateDiv);

    const saveStateButton = document.createElement('button');
    saveStateButton.classList.add('save-state-button');
    saveStateButton.id = id + '_save_state';
    const materialIconSaveState = document.createElement('span');
    materialIconSaveState.classList.add('material-symbols-rounded');
    materialIconSaveState.innerText = 'check';
    saveStateButton.appendChild(materialIconSaveState);
    nameAndSaveStateDiv.appendChild(saveStateButton);

    // add listener to saveStateButton to show a checkmark for 1 second when clicked
    saveStateButton.addEventListener('click', () => {
        saveSourceRowOutputs(id);
    });

    // init autosave timer for this source row
    autoSaveTimers[id] = null;

    const url = document.createElement('input');
    url.type = 'text';
    url.value = source.url || '';
    url.placeholder = 'URL...';
    url.setAttribute('disabled', 'true');
    url.id = id + '_url'
    headerDiv.appendChild(url);

    // edit button
    const editButton = document.createElement('button');
    editButton.id = id + '_edit';
    editButton.classList.add('edit-button');
    const materialIconEdit = document.createElement('span');
    materialIconEdit.classList.add('material-symbols-rounded');
    materialIconEdit.innerText = 'edit_square';
    editButton.appendChild(materialIconEdit);
    editButton.onclick = () => enableEdit(id);
    headerDiv.appendChild(editButton);

    editButtonTimers[id] = null; // Initialize the timer for this edit button

    // delete button
    const deleteButton = document.createElement('button');
    deleteButton.id = id + '_delete';
    deleteButton.classList.add('delete-button');
    const materialIconDelete = document.createElement('span');
    materialIconDelete.classList.add('material-symbols-rounded');
    materialIconDelete.innerText = 'delete';
    deleteButton.appendChild(materialIconDelete);
    deleteButton.addEventListener('click', () => {
        setDeleteDialog(id, true);
    });
    headerDiv.appendChild(deleteButton);

    row.appendChild(headerDiv);

    const selectLabel1 = document.createElement('label');
    selectLabel1.innerText = out1;
    selectLabel1.htmlFor = id + '_output1';
    selectLabel1.style.gridArea = 'label1';

    // <select class="form-control" name="id_output1" id="id_output1" placeholder="Select activities" multiple>
    const multiSelect1 = document.createElement('select');
    multiSelect1.id = id + '_output1';
    multiSelect1.classList.add('form-control');
    multiSelect1.multiple = true;
    multiSelect1.style.gridArea = 'select1';
    row.appendChild(selectLabel1);
    row.appendChild(multiSelect1);


    // const checkboxContainer2 = document.createElement('div');
    // checkboxContainer2.classList.add('checkbox-container');
    const selectLabel2 = document.createElement('label');
    selectLabel2.innerText = out2;
    selectLabel2.htmlFor = id + '_output2';
    selectLabel2.style.gridArea = 'label2';
    const multiSelect2 = document.createElement('select');
    multiSelect2.id = id + '_output2';
    multiSelect2.classList.add('form-control');
    multiSelect2.multiple = true;
    multiSelect2.style.gridArea = 'select2';
    row.appendChild(selectLabel2);
    row.appendChild(multiSelect2);

    categories.forEach(category => {
        const option1 = document.createElement('option');
        option1.value = category;
        option1.innerHTML = capitalizeFirstLetter(category);

        let isChecked1 = source.output1.enabled
        let toCheckCategory = category === "other" ? "?" : category;

        if (isChecked1) {
            isChecked1 = source.output1.allowed.includes(toCheckCategory) || !source.output1.allowed || (source.output1.allowed.length === 1 && source.output1.allowed[0] === "*");
        }
        if (isChecked1) {
            option1.setAttribute('selected', 'selected');
        }
        multiSelect1.appendChild(option1);

        // -------------------------------------------------------------------

        const option2 = document.createElement('option');
        option2.value = category;
        option2.innerHTML = capitalizeFirstLetter(category);

        let isChecked2 = source.output2.enabled
        let toCheckCategory2 = category === "other" ? "?" : category;

        if (isChecked2) {
            isChecked2 = source.output2.allowed.includes(toCheckCategory2) || !source.output2.allowed || (source.output2.allowed.length === 1 && source.output2.allowed[0] === "*");
        }
        if (isChecked2) {
            option2.setAttribute('selected', 'selected');
        }
        multiSelect2.appendChild(option2);

    });

    let c_item1 =  new Choices(multiSelect1, {
        removeItemButton: true,
        placeholder: true,
        placeholderValue: out1active ? 'Select activities' : 'Output not active',
        searchPlaceholderValue: 'Search activities'
    });
    let c_item2 = new Choices(multiSelect2, {
        removeItemButton: true,
        placeholder: true,
        placeholderValue: out2active ? 'Select activities' : 'Output not active',
        searchPlaceholderValue: 'Search activities'
    });

    // add listeners to the multiSelects to trigger autoSave when changed
    multiSelect1.addEventListener('change', () => {
        scheduleAutoSave(id);
    });

    multiSelect2.addEventListener('change', () => {
        scheduleAutoSave(id);
    });

    if (!out1active) {
        c_item1.disable();
    }

    if (!out2active) {
        c_item2.disable();
    }

    // add the source row cover, init with hidden and aria-expanded false
    const sourceRowCover = document.createElement('div');
    sourceRowCover.id = id + '_cover';
    sourceRowCover.classList.add('source-row-cover');
    sourceRowCover.setAttribute('hidden', 'true');
    sourceRowCover.setAttribute('aria-expanded', 'false');


    // warning symbol large
    const warningSymbol = document.createElement('span');
    warningSymbol.classList.add('material-symbols-rounded');
    warningSymbol.classList.add('warning-symbol');
    warningSymbol.innerText = 'warning';
    sourceRowCover.appendChild(warningSymbol);

    // add "delete?" text to the cover
    const deleteText = document.createElement('h2');
    deleteText.innerText = 'Delete?';
    sourceRowCover.appendChild(deleteText);

    // add "Are you sure you want to delete this source?" text to the cover
    const deleteText2 = document.createElement('p');
    deleteText2.innerText = 'Are you sure you want to delete this source?';
    sourceRowCover.appendChild(deleteText2);

    // horizontal split div (flexbox) for the cancel and confirm buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('button-container');

    // cancel delete button, text is "Cancel" no icon
    const cancelDeleteButton = document.createElement('button');
    cancelDeleteButton.id = id + '_cancel_delete';
    cancelDeleteButton.classList.add('cancel-delete-button');
    cancelDeleteButton.innerText = 'Cancel';

    cancelDeleteButton.addEventListener('click', () => {
        setDeleteDialog(id, false);
    });
    buttonContainer.appendChild(cancelDeleteButton);

    // confirm delete button
    const confirmDeleteButton = document.createElement('button');
    confirmDeleteButton.id = id + '_confirm_delete';
    confirmDeleteButton.classList.add('confirm-delete-button');
    confirmDeleteButton.innerText = 'Delete';
    confirmDeleteButton.addEventListener('click', () => {
        // temp
        deleteSource(id);
    });
    buttonContainer.appendChild(confirmDeleteButton);

    sourceRowCover.appendChild(buttonContainer);
    row.appendChild(sourceRowCover);

    mainTile.appendChild(row);

}

function scheduleAutoSave(id) {
    // clear any existing timer for this source row
    if (autoSaveTimers[id]) {
        clearTimeout(autoSaveTimers[id]);
    }

    // set a new timer for this source row
    autoSaveTimers[id] = setTimeout(() => {
        saveSourceRowOutputs(id);
    }, autoSaveDelay);

    // if span is checkmark, change it to a save icon
    const saveStateButton = document.getElementById(id + '_save_state');
    const materialIcon = saveStateButton.querySelector('.material-symbols-rounded');
    if (materialIcon.innerText === 'check') {
        materialIcon.innerText = 'autorenew';
        materialIcon.classList.add('spin');
    }
}


function saveSourceRowOutputs(id) {

    // reset the autoSave timer for this source row
    if (autoSaveTimers[id]) {
        clearTimeout(autoSaveTimers[id]);
    }
    autoSaveTimers[id] = null;

    // save the output filters for the source row with the given id
    const multiSelect1 = document.getElementById(id + '_output1');
    const multiSelect2 = document.getElementById(id + '_output2');

    // lock selects and show loading spinner on save state button
    multiSelect1.setAttribute('disabled', 'true');
    multiSelect2.setAttribute('disabled', 'true');

    const saveStateButton = document.getElementById(id + '_save_state');
    const materialIcon = saveStateButton.querySelector('.material-symbols-rounded');
    materialIcon.innerText = 'autorenew';
    materialIcon.classList.add('spin');

    let selectedOptions1 = Array.from(multiSelect1.selectedOptions).map(option => option.value === "other" ? "?" : option.value);
    let selectedOptions2 = Array.from(multiSelect2.selectedOptions).map(option => option.value === "other" ? "?" : option.value);

    // if all categories are selected, we can simplify the allowed list to just "*"
    if (selectedOptions1.length === categories.length) {
        selectedOptions1 = ["*"];
    }

    if (selectedOptions2.length === categories.length) {
        selectedOptions2 = ["*"];
    }

    const data = {
        output1: {
            enabled: selectedOptions1.length > 0,
            allowed: selectedOptions1
        },
        output2: {
            enabled: selectedOptions2.length > 0,
            allowed: selectedOptions2
        }
    };

    postJsonViaApi('api/sources/' + id, data, (response) => {
        if (response.status === 'ok') {
            console.log('Successfully saved outputs for source ' + id);
        } else {
            console.error('Failed to save outputs for source ' + id + ': ' + response.detail);
        }
    }, (error) => {
        console.error('Error saving outputs for source ' + id + ': ', error);
    });

    // unlock selects and give save state button the done class for 1 second
    multiSelect1.removeAttribute('disabled');
    multiSelect2.removeAttribute('disabled');
    materialIcon.classList.remove('spin');
    materialIcon.innerText = 'check';
    materialIcon.classList.add('done');

    setTimeout(() => {
        materialIcon.classList.remove('done');
    }, 1000);
}

function refreshCache() {
    fetch('api/refresh', {
        method: 'POST'
    }).then(response => {
        if (response.status !== 200) {
            throw new Error('Failed to refresh cache: ' + response.statusText);
        }
    });
}