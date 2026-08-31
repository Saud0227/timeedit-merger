// Main application script

const mainTile = document.getElementById('main-content');
let categories = []
const saveButton = document.getElementById('save');

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

document.addEventListener('DOMContentLoaded', function () {

    getState((state) => {
        document.getElementById('output1a').href = state.external_url + state.output1_url
        document.getElementById('output1a').setAttribute("feed-enabled", state.output1_enabled)
        document.getElementById("output1label").innerHTML = state.output1_name


        document.getElementById('output2a').href = state.external_url + state.output2_url
        document.getElementById('output2a').setAttribute("feed-enabled", state.output2_enabled)
        document.getElementById("output2label").innerHTML = state.output2_name
    })
    getAllCategories();

    loadCurrentSources();
    document.getElementById('new-source-button').addEventListener('click', createEmptySourceRow);
    document.getElementById('reset-button').addEventListener('click', loadCurrentSources);
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
 * Submits the JSON configuration to the server
 */
function submitForm(data) {
    try {

        fetch('api/dynamic', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data, null, 0)
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'ok') {
                    // add the atribute success to save button for 2 seconds
                    saveButton.setAttribute("success", "true");
                    setTimeout(() => {
                        saveButton.removeAttribute("success");
                    }, 1000);
                } else {
                    alert('Failed to write JSON to the server: ' + data.message);
                }
            })
            .catch(error => {
                alert('Error writing JSON to server: ' + error.message);
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


function loadCurrentSources() {
    getJsonViaApi('api/dynamic', (data) => {
        // get source keys and values from data.sources and create a row for each source
        resetSourceRows();
        Object.keys(data.sources).forEach((key, index) => {
            const source = data.sources[key];
            createSourceRow(key, source);
        });
        // document.getElementById('raw_json').value = JSON.stringify(data.sources, null, 2);
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
    while (mainTile.children.length > 1) {
        mainTile.removeChild(mainTile.lastChild);
    }
}

function createEmptySourceRow() {
    getJsonViaApi('api/salt', (data) => {
        const newId = data.salt;
        const emptySource = {
            name: '',
            url: '',
            output1: {
                enabled: false,
                allowed: []
            },
            output2: {
                enabled: false,
                allowed: []
            }
        }
        createSourceRow(newId, emptySource);
    });
}


function createSourceRow(id, source) {
    const row = document.createElement('div');
    row.classList.add('source-row');
    row.id = id

    const name = document.createElement('input')
    name.type = 'text';
    name.value = source.name || '';
    name.placeholder = 'Name...';
    name.id = id + '_name'
    row.appendChild(name);

    const url = document.createElement('input');
    url.type = 'text';
    url.value = source.url || '';
    url.placeholder = 'URL...';
    url.id = id + '_url'
    row.appendChild(url);

    const checkboxContainer1 = document.createElement('div');
    checkboxContainer1.classList.add('checkbox-container');

    const checkboxContainer2 = document.createElement('div');
    checkboxContainer2.classList.add('checkbox-container');

    categories.forEach(category => {
        const checkbox1 = document.createElement('input');
        checkbox1.type = 'checkbox';
        checkbox1.id = id + '_output1_' + category;

        let isChecked = source.output1.enabled
        let toCheckCategory = category === "other" ? "?" : category;

        if (isChecked) {
            isChecked = source.output1.allowed.includes(toCheckCategory) || !source.output1.allowed || (source.output1.allowed.length === 1 && source.output1.allowed[0] === "*");
        }

        checkbox1.checked = isChecked;
        checkboxContainer1.appendChild(checkbox1);

        const label1 = document.createElement('label');
        label1.htmlFor = checkbox1.id;
        label1.innerText = capitalizeFirstLetter(category);

        label1.appendChild(checkbox1)
        checkboxContainer1.appendChild(label1);

        // -------------------------------------------------------------------

        const checkbox2 = document.createElement('input');
        checkbox2.type = 'checkbox';
        checkbox2.id = id + '_output2_' + category;

        isChecked = source.output2.enabled

        if (isChecked) {
            isChecked = source.output2.allowed.includes(category) || !source.output2.allowed || (source.output2.allowed.length === 1 && source.output2.allowed[0] === "*");
        }

        checkbox2.checked = isChecked;
        checkboxContainer2.appendChild(checkbox2);

        const label2 = document.createElement('label');
        label2.htmlFor = checkbox2.id;
        label2.innerText = capitalizeFirstLetter(category);

        label2.appendChild(checkbox2)
        checkboxContainer2.appendChild(label2);
    });

    row.appendChild(checkboxContainer1);
    row.appendChild(checkboxContainer2);

    const deleteButton = document.createElement('input');
    deleteButton.type = 'checkbox';
    deleteButton.id = id + '_delete';

    row.appendChild(deleteButton);

    mainTile.appendChild(row);

}


function write() {
    // get all children till main tile
    const sources = {};
    for (let i = 1; i < mainTile.children.length; i++) {
        const row = mainTile.children[i];
        const id = row.id;

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
        loadCurrentSources();
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