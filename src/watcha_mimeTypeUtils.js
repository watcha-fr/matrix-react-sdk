import { _t } from "./languageHandler";

function getTypeObject() {
    return {
        audio: _t("Audio"),
        image: _t("Image"),
        video: _t("Video")
    };
}

function getSubtypesObject() {
    return {
        Document: {
            pdf: "PDF",
            msword: "Word",
            "vnd.openxmlformats-officedocument.wordprocessingml.document":
                "Word",
            "vnd.ms-excel": "Excel",
            "vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
            "vnd.ms-powerpoint": "PowerPoint",
            "vnd.openxmlformats-officedocument.presentationml.presentation":
                "PowerPoint",
            "vnd.oasis.opendocument.text": "Writer",
            "vnd.oasis.opendocument.spreadsheet": "Calc",
            "vnd.oasis.opendocument.presentation": "Impress"
        },
        Archive: {
            zip: "ZIP",
            "x-rar-compressed": "RAR",
            "x-7z-compressed": "7-Zip"
        },
        "": {
            "x-javascript": "JavaScript"
        }
    };
}

export function formatMimeType({ mimeType, filename }) {
    const [type, subtype] = mimeType.split("/");
    const types = getTypeObject();
    if (types.hasOwnProperty(type)) {
        const suffix = filename
            .split(".")
            .pop()
            .toUpperCase();
        const readableType = types[type];
        return _t("%(suffix)s %(readableType)s", {
            suffix,
            readableType
        });
    }
    const subtypes = getSubtypesObject();
    const categories = Object.keys(subtypes);
    for (const category of categories) {
        if (subtypes[category].hasOwnProperty(subtype)) {
            const readableSubtype = subtypes[category][subtype];
            return _t("%(readableSubtype)s %(category)s", {
                readableSubtype,
                category
            });
        }
    }
    return mimeType;
}

export function getIconFromMimeType(mimeType) {
    if (mimeType === "application/pdf") {
        return require("../res/img/mimeType/watcha_pdf.svg");
    }
    if (
        [
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ].includes(mimeType)
    ) {
        return require("../res/img/mimeType/watcha_word.svg");
    }
    if (
        [
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ].includes(mimeType)
    ) {
        return require("../res/img/mimeType/watcha_excel.svg");
    }
    if (
        [
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ].includes(mimeType)
    ) {
        return require("../res/img/mimeType/watcha_powerpoint.svg");
    }
    if (mimeType === "application/vnd.oasis.opendocument.text") {
        return require("../res/img/mimeType/watcha_writer.svg");
    }
    if (mimeType === "application/vnd.oasis.opendocument.spreadsheet") {
        return require("../res/img/mimeType/watcha_calc.svg");
    }
    if (mimeType === "application/vnd.oasis.opendocument.presentation") {
        return require("../res/img/mimeType/watcha_impress.svg");
    }
    return require("../res/img/watcha_file.svg");
}
