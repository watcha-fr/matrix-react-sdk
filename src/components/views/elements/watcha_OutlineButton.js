import PropTypes from "prop-types";

function OutlineButton({ children, ...restProps }) {
    restProps.className = "watcha_OutlineButton" + (restProps.className ? " " + restProps.className : "")
    return (
        <button
            type="button"
            {...restProps}
        >
            {children}
        </button>
    );
}

OutlineButton.propTypes = {
    children: PropTypes.isRequired
};

export default OutlineButton;
