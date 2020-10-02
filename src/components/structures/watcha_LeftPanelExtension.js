import React, { useEffect, useState } from "react";
import classNames from "classnames";

import { _t } from "../../languageHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";

import IconButton from "../views/elements/watcha_IconButton";
import OutlineIconButton from "../views/elements/watcha_OutlineIconButton";

export default ({ collapsed }) => {
    const [isNextcloudReachable, setNextcloudReachable] = useState(false);
    const [isSynapseAdmin, setIsSynapseAdmin] = useState(false);

    useEffect(() => {
        fetch("/nextcloud").then(response => {
            if (response.status == 200) {
                setNextcloudReachable(true);
            } else {
                console.warn(
                    `Nextcloud is unreachable (status code: ${response.status})`
                );
            }
        });

        MatrixClientPeg.get()
            .isSynapseAdministrator()
            .then(isAdmin => {
                setIsSynapseAdmin(isAdmin);
            })
            .catch(error => {
                setIsSynapseAdmin(false);
                console.error(error);
            });
    }, []);

    const nextcloudAccessRestProps = {
        onClick: () => window.open("/nextcloud", "nextcloud"),
        title: _t("Open Nextcloud in a new tab"),
    };

    let nextcloudAccess;
    if (isNextcloudReachable) {
        nextcloudAccess = collapsed ? (
            <IconButton
                className="watcha_NextcloudAccess_IconButton"
                {...nextcloudAccessRestProps}
            />
        ) : (
            <OutlineIconButton
                className="watcha_NextcloudAccess_OutlineIconButton"
                {...nextcloudAccessRestProps}
            >
                Nextcloud
            </OutlineIconButton>
        );
    }

    let adminAccess;
    if (isSynapseAdmin) {
        const adminAccessRestProps = {
            onClick: () => window.open("/admin", "admin"),
            title: _t("Open the administration console in a new tab"),
        };
        adminAccess = collapsed ? (
            <IconButton
                className="watcha_AdminAccess_IconButton"
                {...adminAccessRestProps}
            />
        ) : (
            <OutlineIconButton
                className="watcha_AdminAccess_OutlineIconButton"
                {...adminAccessRestProps}
            >
                {_t("Administration")}
            </OutlineIconButton>
        );
    }

    return nextcloudAccess || adminAccess ? (
        <div
            className={classNames("watcha_LeftPanelExtension", {
                watcha_LeftPanelExtension_collapsed: collapsed,
            })}
        >
            {nextcloudAccess}
            {adminAccess}
        </div>
    ) : null;
};
