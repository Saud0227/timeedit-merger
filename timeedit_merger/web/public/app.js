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
    document.getElementById('new-source-button').addEventListener('click', createEmptySourceRow);
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

function createEmptySourceRow() {
    // getJsonViaApi('api/salt', (data) => {
    //     const newId = data.salt;
    //     const emptySource = {
    //         name: '',
    //         url: '',
    //         output1: {
    //             enabled: false,
    //             allowed: []
    //         },
    //         output2: {
    //             enabled: false,
    //             allowed: []
    //         }
    //     }
    //     createSourceRow(newId, emptySource);
    // });
    console.log("Discontinued")
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
    headerDiv.appendChild(name);

    const url = document.createElement('input');
    url.type = 'text';
    url.value = source.url || '';
    url.placeholder = 'URL...';
    url.id = id + '_url'
    headerDiv.appendChild(url);

    // edit button

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
        placeholderValue: 'Select activities',
        searchPlaceholderValue: 'Search activities'
    });
    let c_item2 = new Choices(multiSelect2, {
        removeItemButton: true,
        placeholder: true,
        placeholderValue: 'Select activities',
        searchPlaceholderValue: 'Search activities'
    });

    if (!out1active) {
        c_item1.disable();
    }

    if (!out2active) {
        c_item2.disable();
    }

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