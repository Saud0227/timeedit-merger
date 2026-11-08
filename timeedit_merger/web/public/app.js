// Main application script

const mainTile = document.getElementById('main-content');
let categories = []
let out1 = ""
let out1active = false
let out2 = ""
let out2active = false
const saveButton = document.getElementById('save');

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
    saveButton.addEventListener('click', write);
    console.log('Application loaded');
});

function validateJson(data) {

    try {

        fetch('api/dynamic/validate', {
            method: 'PUT',
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

    // change the edit button to a save button
    const editButton = document.getElementById(id + '_edit');
    editButton.removeEventListener('click', () => {
        enableEdit(id);
    });
    editButton.addEventListener('click', () => {
        submitEdit(id);
    });
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
    console.log('Work in progress....');
}

function createSourceRow(id, source) {
    const row = document.createElement('div');
    row.classList.add('source-row');
    row.id = id

    const headerDiv = document.createElement('div');
    headerDiv.classList.add('source-header');

    const name = document.createElement('input')
    name.type = 'text';
    name.value = source.name || '';
    name.placeholder = 'Name...';
    name.id = id + '_name'
    name.setAttribute('disabled', 'true');
    headerDiv.appendChild(name);

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
    materialIconEdit.innerText = 'edit';
    editButton.appendChild(materialIconEdit);
    editButton.addEventListener('click', () => {
        enableEdit(id);
    });
    headerDiv.appendChild(editButton);

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
        console.log("Deleting source: " + id);
    });
    buttonContainer.appendChild(confirmDeleteButton);

    sourceRowCover.appendChild(buttonContainer);
    row.appendChild(sourceRowCover);

    mainTile.appendChild(row);

}


function write() {
    // get all children till main tile
    const sources = {};
    for (let i = 1; i < mainTile.children.length; i++) {
        const row = mainTile.children[i];
        const id = row.id;

        console.log("WE ARE WRITING SOURCE: " + id);

        const deleteCheckbox = document.getElementById(id + '_delete');
        if (deleteCheckbox.checked) {
            continue; // skip this source if marked for deletion
        }

        const name = document.getElementById(id + '_name').value;
        const url = document.getElementById(id + '_url').value;

        let output1 = [];
        let output2 = [];

        categories.forEach(category => {
            const checkbox1 = document.getElementById(id + '_output1_' + category);
            if (checkbox1.checked) {
                if (category.toLowerCase() === "other") {
                    output1.push("?");
                } else {
                    output1.push(category.toLowerCase());
                }
            }

            const checkbox2 = document.getElementById(id + '_output2_' + category);
            if (checkbox2.checked) {
                if (category.toLowerCase() === "other") {
                    output2.push("?");
                } else {
                    output2.push(category.toLowerCase());
                }
            }
        });

        // if all categories are checked, we can simplify the allowed list to just "*"
        if (output1.length === categories.length ){
            output1 = ["*"];
        }

        if (output2.length === categories.length ){
            output2 = ["*"];
        }

        sources[id] = {
            name: name,
            url: url,
            output1: {
                enabled: output1.length > 0,
                allowed: output1
            },
            output2: {
                enabled: output2.length > 0,
                allowed: output2
            }
        }

    }
    validateJson({ sources: sources })
    submitForm({ sources: sources });
    setTimeout(() => {
        loadAllCurrentSources();
    }, 500);
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