import React, { useState, ChangeEvent, useEffect } from 'react';
import {
    Box,
    TextField,
    Button,
    Typography,
    Alert,
    CircularProgress,
    Stack,
    Paper,
    Divider,
    Card,
    CardContent,
} from '@mui/material';

// Kiểu dữ liệu cho input gửi lên API
interface TreasureHuntInput {
    n: number;
    m: number;
    p: number;
    matrix: number[][];
}

// Kiểu dữ liệu cho output từ API
interface TreasureHuntOutput {
    id: number;
    minimumFuel: number;
}

// Kiểu cho lỗi validation
interface ValidationErrors {
    n?: string;
    m?: string;
    p?: string;
    matrix?: { [key: string]: string };
}

// Kiểu dữ liệu đầy đủ cho kết quả theo ID
interface TreasureMapDto {
    n: number;
    m: number;
    p: number;
    matrix: number[][];
}

interface TreasureResultDto {
    id: number;
    minimumFuel: number;
    input: TreasureMapDto;
    calculatedAt: string;
}

const TreasureHuntForm: React.FC = () => {
    const [n, setN] = useState<string>('');
    const [m, setM] = useState<string>('');
    const [p, setP] = useState<string>('');
    const [matrix, setMatrix] = useState<string[][]>([]);
    const [result, setResult] = useState<TreasureHuntOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [searchId, setSearchId] = useState<string>('');
    const [searchResult, setSearchResult] = useState<TreasureResultDto | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searching, setSearching] = useState<boolean>(false);

    const numN = parseInt(n, 10);
    const numM = parseInt(m, 10);
    const numP = parseInt(p, 10);

    // Effect to initialize/resize matrix when n or m changes
    useEffect(() => {
        if (!isNaN(numN) && numN > 0 && !isNaN(numM) && numM > 0) {
            setMatrix(prevMatrix => {
                const newMatrix: string[][] = Array(numN).fill(0).map(() => Array(numM).fill(''));
                // Preserve existing values if resizing
                for (let i = 0; i < Math.min(numN, prevMatrix.length); i++) {
                    for (let j = 0; j < Math.min(numM, prevMatrix[i]?.length ?? 0); j++) {
                        if (prevMatrix[i] && prevMatrix[i][j] !== undefined) {
                            newMatrix[i][j] = prevMatrix[i][j];
                        }
                    }
                }
                return newMatrix;
            });
            // Clear matrix validation errors when size changes
            if (validationErrors.matrix) {
                setValidationErrors(prev => ({ ...prev, matrix: {} }));
            }
        } else {
            setMatrix([]); // Clear matrix if n or m is invalid
        }
    }, [n, m]); // Dependencies: n, m

    const handleNumericInputChange = (
        setter: React.Dispatch<React.SetStateAction<string>>,
        field: string,
        allowZero: boolean = false // Allow zero for matrix cells initially
    ) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        const regex = allowZero ? /^\d*$/ : /^[1-9]\d*$/; // Allow empty string or positive integers (or zero if allowed)

        if (value === '' || regex.test(value)) {
            setter(value);
            if (validationErrors[field as keyof ValidationErrors]) { // Type assertion for index access
                setValidationErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[field as keyof ValidationErrors]; // Type assertion
                    return newErrors; // Return the modified errors object
                });
            }
        } else if (value === '0' && !allowZero && field !== 'n' && field !== 'm' && field !== 'p') {
            // Prevent entering '0' for n, m, p if not allowed (already handled by regex for positive)
            // Allow '0' for matrix cells if allowZero is true
        } else if (!allowZero && value.startsWith('0') && value.length > 1) {
            // Prevent leading zeros for n, m, p (e.g., 01, 005)
            setter(value.replace(/^0+/, '')); // Remove leading zeros
        }
    };

    const handleMatrixCellChange = (rowIndex: number, colIndex: number) => (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        // Allow empty string, positive integers, or zero
        if (value === '' || /^\d*$/.test(value)) {
            const newMatrix = matrix.map(row => [...row]);
            newMatrix[rowIndex][colIndex] = value;
            setMatrix(newMatrix);

            // Clear specific cell validation error
            if (typeof validationErrors.matrix === 'object' && validationErrors.matrix[`${rowIndex}-${colIndex}`]) {
                setValidationErrors(prev => {
                    const matrixErrors = { ...(typeof prev.matrix === 'object' ? prev.matrix : {}) };
                    delete matrixErrors[`${rowIndex}-${colIndex}`];
                    // Return the whole validation state object, potentially with an empty matrix object if last error removed
                    return { ...prev, matrix: Object.keys(matrixErrors).length > 0 ? matrixErrors : undefined };
                });
            }
        }
    };

    // --- Validation Logic ---
    const validateForm = (): boolean => {
        const errors: ValidationErrors = {}; // Use the defined type
        let isValid = true;

        if (!n || numN <= 0) {
            errors.n = 'N must be a positive integer.';
            isValid = false;
        }
        if (!m || numM <= 0) {
            errors.m = 'M must be a positive integer.';
            isValid = false;
        }
        if (!p || numP <= 0) {
            errors.p = 'P must be a positive integer.';
            isValid = false;
        }

        const matrixErrors: { [key: string]: string } = {};
        let matrixIsValid = true;
        if (numN > 0 && numM > 0) {
            for (let i = 0; i < numN; i++) {
                for (let j = 0; j < numM; j++) {
                    const cellValue = matrix[i]?.[j];
                    const cellNum = parseInt(cellValue, 10);
                    if (cellValue === undefined || cellValue === '' || isNaN(cellNum)) {
                        matrixErrors[`${i}-${j}`] = 'Required';
                        matrixIsValid = false;
                    } else if (!isNaN(numP) && numP > 0 && (cellNum < 1 || cellNum > numP)) {
                        matrixErrors[`${i}-${j}`] = `Must be between 1 and ${numP}`;
                        matrixIsValid = false;
                    }
                }
            }
        }

        if (!matrixIsValid) {
            errors.matrix = matrixErrors;
            isValid = false;
        }

        setValidationErrors(errors);
        return isValid;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return; // Stop submission if validation fails
        }

        setLoading(true);
        setError(null);
        setResult(null);
        // Validation errors are set in validateForm

        // Convert matrix strings to numbers
        const parsedMatrix = matrix.map(row => row.map(cell => parseInt(cell, 10)));

        const inputData: TreasureHuntInput = {
            n: numN,
            m: numM,
            p: numP,
            matrix: parsedMatrix,
        };

        console.log('Submitting:', inputData);

        try {
            // Use fetch API
            const response = await fetch('https://localhost:7219/api/TreasureHunt/solve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Add any other headers if required, like Authorization
                },
                body: JSON.stringify(inputData)
            });

            // Check if the response status indicates success (e.g., 200 OK)
            if (!response.ok) {
                // Try to parse error response from backend if available
                let errorBody = 'Unknown error';
                try {
                    const errorData = await response.json();
                    errorBody = errorData.message || errorData.title || JSON.stringify(errorData);
                } catch (parseError) {
                    errorBody = await response.text(); // Fallback to raw text
                }
                throw new Error(`HTTP error ${response.status}: ${errorBody}`);
            }

            // Parse the successful JSON response
            const data: TreasureHuntOutput = await response.json();
            setResult(data);

        } catch (err: any) {
            console.error("API Call failed:", err);
            setError(err.message || 'An error occurred while communicating with the server.');
        } finally {
            setLoading(false);
        }
    };

    // Function to handle search by ID
    const handleSearch = async () => {
        const id = parseInt(searchId, 10);

        if (isNaN(id) || id <= 0) {
            setSearchError('Please enter a valid positive ID number');
            return;
        }

        setSearching(true);
        setSearchError(null);
        setSearchResult(null);

        try {
            const response = await fetch(`https://localhost:7219/api/TreasureHunt/${id}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) {
                let errorMessage = `Error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.title || errorMessage;
                } catch (e) {
                    // Fallback to status text if response isn't JSON
                    errorMessage = `${errorMessage} - ${response.statusText}`;
                }

                throw new Error(errorMessage);
            }

            const data: TreasureResultDto = await response.json();
            setSearchResult(data);
        } catch (err: any) {
            console.error("Search API call failed:", err);
            setSearchError(err.message || 'Failed to fetch result');
        } finally {
            setSearching(false);
        }
    };

    // Format date string for display
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    // Function to render matrix from search result
    const renderResultMatrix = (matrix: number[][] | undefined) => {
        if (!matrix || matrix.length === 0) {
            return <Typography color="text.secondary">No matrix data</Typography>;
        }

        return (
            <Box
                display="grid"
                gridTemplateColumns={`repeat(${matrix[0].length}, 1fr)`}
                gap={1}
                sx={{ mt: 1, maxWidth: '100%', overflowX: 'auto' }}
            >
                {matrix.flatMap((row, i) =>
                    row.map((cell, j) => (
                        <Box
                            key={`result-${i}-${j}`}
                            sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                p: 1,
                                textAlign: 'center',
                                borderRadius: 1,
                                bgcolor: 'background.default',
                            }}
                        >
                            {cell}
                        </Box>
                    ))
                )}
            </Box>
        );
    };

    // --- Rendering Logic ---
    const renderMatrixInputs = () => {
        if (isNaN(numN) || numN <= 0 || isNaN(numM) || numM <= 0) {
            return <Typography sx={{ mt: 1, color: 'text.secondary' }}>Enter valid N and M to display matrix.</Typography>;
        }

        // Use CSS Grid directly via Box for simpler layout control
        return (
            <Box
                display="grid"
                gridTemplateColumns={`repeat(${numM}, 1fr)`} // Create M columns
                gap={1} // Spacing between cells
                sx={{ maxWidth: '100%', overflowX: 'auto' }} // Ensure it fits and scrolls if needed
            >
                {matrix.flatMap((row, i) => // Use flatMap to create a single array of cells
                    row.map((cell, j) => {
                        const cellKey = `${i}-${j}`;
                        const cellError = validationErrors.matrix ? validationErrors.matrix[cellKey] : undefined;
                        return (
                            <TextField
                                key={cellKey} // Key should be on the top-level element returned by map
                                type="number"
                                value={cell ?? ''}
                                onChange={handleMatrixCellChange(i, j)}
                                variant="outlined"
                                size="small"
                                fullWidth // Let TextField fill the grid cell
                                required
                                error={!!cellError}
                                helperText={cellError}
                                inputProps={{
                                    min: "1",
                                    max: !isNaN(numP) && numP > 0 ? String(numP) : undefined,
                                    style: { textAlign: 'center' }
                                }}
                            />
                        );
                    })
                )}
            </Box>
        );
    };

    // Check if form is generally valid for enabling button (more precise validation happens on submit)
    const isFormPotentiallyValid = () => {
        return !isNaN(numN) && numN > 0 && !isNaN(numM) && numM > 0 && !isNaN(numP) && numP > 0 && matrix.length === numN;
    };

    return (
        <Box sx={{
            p: { xs: 2, md: 4 }, // Tăng padding trên màn hình lớn
            width: '100vw', // Sử dụng chiều rộng của viewport
            maxWidth: '100%',
            margin: 'auto',
            fontSize: '1.2rem', // Tăng kích thước font chung
            boxSizing: 'border-box', // Đảm bảo padding không làm vỡ layout
            overflow: 'hidden', // Ngăn thanh cuộn ngang
        }}>
            <Typography variant="h3" gutterBottom textAlign="center" sx={{ mb: 4 }}>
                Treasure Hunt Solver
            </Typography>

            {/* Layout 2 cột */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    gap: { xs: 3, md: 4 }, // Tăng khoảng cách giữa các cột
                    minHeight: { md: '70vh' }, // Đảm bảo chiều cao tối thiểu trên desktop
                }}
            >
                {/* CỘT TRÁI: Phần nhập và tính toán - màu xanh dương nhạt */}
                <Box sx={{
                    flex: 1,
                    minWidth: 0,
                    bgcolor: '#e3f2fd',
                    borderRadius: 3, // Tăng bo góc
                    overflow: 'hidden',
                    boxShadow: 3, // Thêm đổ bóng
                }}>
                    <Paper sx={{
                        p: { xs: 2, md: 4 }, // Tăng padding bên trong
                        height: '100%',
                        bgcolor: 'transparent',
                        boxShadow: 'none'
                    }} elevation={0}>
                        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
                            Solve New Problem
                        </Typography>

                        {/* Existing form components */}
                        <Stack spacing={3}> {/* Tăng khoảng cách trong Stack */}
                            {/* Row 1: N, M, P Inputs */}
                            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={2}>
                                <Box flex={1}>
                                    <TextField
                                        label="N (rows)"
                                        type="number"
                                        value={n}
                                        onChange={handleNumericInputChange(setN, 'n')}
                                        onBlur={() => validateForm()}
                                        fullWidth
                                        required
                                        error={!!validationErrors.n}
                                        helperText={validationErrors.n}
                                        inputProps={{ min: "1" }}
                                        sx={{ '& .MuiInputBase-input': { fontSize: '1.2rem' } }} // Tăng font cho input
                                    />
                                </Box>
                                <Box flex={1}>
                                    <TextField
                                        label="M (columns)"
                                        type="number"
                                        value={m}
                                        onChange={handleNumericInputChange(setM, 'm')}
                                        onBlur={() => validateForm()}
                                        fullWidth
                                        required
                                        error={!!validationErrors.m}
                                        helperText={validationErrors.m}
                                        inputProps={{ min: "1" }}
                                        sx={{ '& .MuiInputBase-input': { fontSize: '1.2rem' } }}
                                    />
                                </Box>
                                <Box flex={1}>
                                    <TextField
                                        label="P (max value)"
                                        type="number"
                                        value={p}
                                        onChange={handleNumericInputChange(setP, 'p')}
                                        onBlur={() => validateForm()}
                                        fullWidth
                                        required
                                        error={!!validationErrors.p}
                                        helperText={validationErrors.p}
                                        inputProps={{ min: "1" }}
                                        sx={{ '& .MuiInputBase-input': { fontSize: '1.2rem' } }}
                                    />
                                </Box>
                            </Box>

                            {/* Row 2: Matrix Input Area Title and Content */}
                            <Box>
                                <Typography variant="h6" sx={{ mt: 2, mb: 2, fontWeight: 'bold' }}>
                                    Matrix Input ({numN > 0 ? numN : '?'} x {numM > 0 ? numM : '?'})
                                </Typography>
                                {renderMatrixInputs()}
                            </Box>

                            {/* Row 3: Submit Button */}
                            <Box>
                                <Button
                                    variant="contained"
                                    onClick={handleSubmit}
                                    disabled={loading || !isFormPotentiallyValid()}
                                    sx={{
                                        mt: 3,
                                        py: 1.5, // Tăng chiều cao nút
                                        fontSize: '1.2rem', // Tăng font cho nút
                                        fontWeight: 'bold',
                                        width: '100%'
                                    }}
                                    fullWidth
                                >
                                    {loading ? <CircularProgress size={28} /> : 'Solve'}
                                </Button>
                            </Box>

                            {/* Row 4: Result Area (Conditionally Rendered) */}
                            {result && !loading && (
                                <Box>
                                    <Alert severity="success" sx={{ mt: 2 }}>
                                        <Typography>Calculation ID: {result.id}</Typography>
                                        <Typography>Minimum Fuel Required: {result.minimumFuel}</Typography>
                                    </Alert>
                                </Box>
                            )}

                            {/* Row 5: Error Area (Conditionally Rendered) */}
                            {error && !loading && (
                                <Box>
                                    <Alert severity="error" sx={{ mt: 2 }}>
                                        Error: {error}
                                    </Alert>
                                </Box>
                            )}
                        </Stack>
                    </Paper>
                </Box>

                {/* CỘT PHẢI: Phần tìm kiếm - màu hồng */}
                <Box sx={{
                    flex: 1,
                    minWidth: 0,
                    bgcolor: '#fce4ec',
                    borderRadius: 3, // Tăng bo góc
                    overflow: 'hidden',
                    boxShadow: 3, // Thêm đổ bóng
                }}>
                    <Paper sx={{
                        p: { xs: 2, md: 4 }, // Tăng padding bên trong
                        height: '100%',
                        bgcolor: 'transparent',
                        boxShadow: 'none'
                    }} elevation={0}>
                        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
                            Find Existing Result
                        </Typography>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'row',  // Luôn hiển thị theo chiều ngang
                                gap: 2,
                                alignItems: 'center',  // Căn giữa các phần tử theo chiều dọc
                                width: '100%'
                            }}
                        >
                            <TextField
                                label="Result ID"
                                type="number"
                                value={searchId}
                                onChange={(e) => setSearchId(e.target.value)}
                                error={!!searchError}
                                helperText={searchError}
                                sx={{
                                    flexGrow: 1,
                                    '& .MuiInputBase-input': { fontSize: '1.2rem' }
                                }}
                                inputProps={{ min: "1" }}
                            />
                            <Button
                                variant="outlined"
                                onClick={handleSearch}
                                disabled={searching || !searchId}
                                sx={{
                                    height: '56px',    // Đặt chiều cao cố định phù hợp với TextField
                                    px: 3,             // Padding ngang
                                    fontSize: '1.1rem',
                                    minWidth: '120px', // Đảm bảo chiều rộng tối thiểu
                                    alignSelf: 'flex-start', // Đặt ở đầu để tránh bị ảnh hưởng bởi helperText
                                    whiteSpace: 'nowrap' // Đảm bảo text không bị ngắt
                                }}
                            >
                                {searching ? <CircularProgress size={28} /> : 'SEARCH'}
                            </Button>
                        </Box>

                        {/* Search Result Display - làm lớn hơn */}
                        {searchResult && (
                            <Card sx={{ mt: 3, boxShadow: 2 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h5" fontWeight="bold" gutterBottom>
                                        Result #{searchResult.id}
                                    </Typography>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                                        <Box>
                                            <Typography variant="body1" color="text.secondary" fontWeight="medium">
                                                Minimum Fuel Required
                                            </Typography>
                                            <Typography variant="h4" color="primary" fontWeight="bold" gutterBottom>
                                                {searchResult.minimumFuel}
                                            </Typography>
                                            <Typography variant="body1" color="text.secondary" fontWeight="medium">
                                                Calculated At
                                            </Typography>
                                            <Typography variant="body1" fontWeight="medium" gutterBottom>
                                                {formatDate(searchResult.calculatedAt)}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="body1" color="text.secondary" fontWeight="medium">
                                                Input Parameters
                                            </Typography>
                                            <Typography variant="body1" fontWeight="medium">
                                                N: {searchResult.input?.n || '-'},
                                                M: {searchResult.input?.m || '-'},
                                                P: {searchResult.input?.p || '-'}
                                            </Typography>

                                            <Typography variant="body1" color="text.secondary" fontWeight="medium" sx={{ mt: 2 }}>
                                                Input Matrix
                                            </Typography>
                                            {renderResultMatrix(searchResult.input?.matrix)}
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        )}

                        {searchError && !searchResult && !searching && (
                            <Alert severity="error" sx={{ mt: 3, p: 2, fontSize: '1.1rem' }}>
                                {searchError}
                            </Alert>
                        )}
                    </Paper>
                </Box>
            </Box>
        </Box>
    );
};

export default TreasureHuntForm; 