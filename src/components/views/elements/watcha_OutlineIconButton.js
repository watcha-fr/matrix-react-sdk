import PropTypes from "prop-types";
import React from "react";

import OutlineButton from "./watcha_OutlineButton";

function OutlineIconButton({ children, className, ...restProps }) {
    className = "watcha_OutlineIconButton" + " " + className;
    return (
        <OutlineButton
            className="watcha_OutlineIconButton_container"
            {...restProps}
        >
            {children}
            <span {...{ className }} />
        </OutlineButton>
    );
}

OutlineIconButton.propTypes = {
    children: PropTypes.string.isRequired,
    className: PropTypes.string.isRequired
};

export default OutlineIconButton;
