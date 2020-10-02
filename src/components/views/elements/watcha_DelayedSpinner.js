import React from "react";
import * as sdk from "../../../index";
import classNames from 'classnames';

export default ({ className }) => {
    const Spinner = sdk.getComponent("elements.Spinner");
    return (
        <div className={classNames("watcha_DelayedSpinner", className)}>
            <Spinner />
        </div>
    );
};
