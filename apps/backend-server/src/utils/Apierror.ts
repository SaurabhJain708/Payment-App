class ApiError {
    statusCode: number;
    message: string;
    data: any;
    success: boolean;
    errors: Array<any>;

    constructor(
        statusCode: number,
        message: string = "Something went wrong",
        errors: Array<any> = [],
    ) {
        this.statusCode = statusCode;
        this.message = message;
        this.data = null;
        this.success = false;
        this.errors = errors;
    }
}

export { ApiError }; 