import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { Button, Card, CardContent, Box } from '@mui/material';
import { Restaurant, FitnessCenter, BarChart, PictureAsPdf, ArrowForward, PlayArrow } from '@mui/icons-material';
import './AiFitnessCoach.css';

const AiFitnessCoach = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthContext();

  const handleTryNow = () => {
    if (!isAuthenticated) {
      navigate('/auth');
    } else {
      // Navigate to the actual AI coach functionality
      navigate('/aicoach');
    }
  };

  const features = [
    {
      icon: <Restaurant sx={{ fontSize: { xs: 18, sm: 20 } }} />,
      title: 'Smart Meal Plans',
      description: 'Breakfast, lunch, dinner & snacks with calorie tracking'
    },
    {
      icon: <FitnessCenter sx={{ fontSize: { xs: 18, sm: 20 } }} />,
      title: 'Custom Workouts',
      description: 'Personalized exercise plans based on your goals'
    },
    {
      icon: <BarChart sx={{ fontSize: { xs: 18, sm: 20 } }} />,
      title: 'Calorie Tracking',
      description: 'Complete nutritional breakdown for every meal'
    },
    {
      icon: <PictureAsPdf sx={{ fontSize: { xs: 18, sm: 20 } }} />,
      title: 'PDF Downloads',
      description: 'Save your plans for offline access'
    }
  ];

  return (
    <Box className="ai-fitness-coach-background">
      <Box className="ai-fitness-coach-container">
        <Box className="hero-spacer" />

        <Box className="hero-text">
          <h1>
            Your Personal<br />
            <span className="highlight">AI Coach</span>
          </h1>
          <p>
            Get personalized meal plans and workout routines tailored just for you.<br />
            Smart nutrition and fitness guidance powered by AI.
          </p>
          <Box sx={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            '@media (max-width: 48rem)': {
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
            }
          }}>
            <Button
              variant="contained"
              onClick={handleTryNow}
              endIcon={<ArrowForward />}
              disableElevation
              sx={{
                background: '#CCD853 !important',
                color: '#2D5F6D !important',
                padding: '0.5rem 1.25rem !important',
                borderRadius: '0.5rem !important',
                fontSize: 'clamp(0.813rem, 1.5vw, 0.875rem) !important',
                fontWeight: 600,
                textTransform: 'none',
                gap: '5px',
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: '#B8D843 !important',
                  transform: 'translateY(-0.125rem)',
                  boxShadow: '0 0.5rem 1.25rem rgba(204, 216, 83, 0.3) !important',
                },
                '.MuiButton-endIcon': {
                  marginLeft: 0,
                },
                '@media (max-width: 48rem)': {
                  minWidth: '160px',
                  maxWidth: '200px',
                  padding: '0.75rem 1.5rem !important',
                }
              }}
            >
              Try Now
            </Button>
            <Button
              variant="outlined"
              endIcon={<PlayArrow />}
              sx={{
                background: 'transparent !important',
                color: '#B8D843 !important',
                padding: '0.5rem 1.25rem !important',
                border: '0.125rem solid #B8D843 !important',
                borderRadius: '0.5rem !important',
                fontSize: 'clamp(0.813rem, 1.5vw, 0.875rem) !important',
                fontWeight: 600,
                textTransform: 'none',
                gap: '5px',
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: 'rgba(184, 216, 67, 0.1) !important',
                  borderColor: '#CCD853 !important',
                },
                '.MuiButton-endIcon': {
                  marginLeft: 0,
                },
                '@media (max-width: 48rem)': {
                  minWidth: '160px',
                  maxWidth: '200px',
                  padding: '0.75rem 1.5rem !important',
                }
              }}
            >
              Watch Demo
            </Button>
          </Box>
        </Box>

        <Box className="features-grid">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="feature-card"
              elevation={0}
              sx={{
                background: 'rgba(44, 44, 44, 0.21) !important',
                backdropFilter: 'blur(26px)',
                WebkitBackdropFilter: 'blur(26px)',
                padding: '1.5rem 1.25rem !important',
                '@media (max-width: 48rem)': {
                  padding: '1.25rem 1rem !important',
                  minHeight: '140px',
                },
                '@media (max-width: 30rem)': {
                  padding: '1rem 0.75rem !important',
                  minHeight: '130px',
                }
              }}
            >
              <CardContent sx={{
                padding: '0 !important',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2.5rem',
                  height: '2.5rem',
                  background: '#CCD853',
                  borderRadius: '0.5rem',
                  marginBottom: '0.75rem',
                  color: '#2D5F6D',
                  flexShrink: 0,
                  '@media (max-width: 48rem)': {
                    width: '2.75rem',
                    height: '2.75rem',
                    marginBottom: '0.625rem',
                  },
                  '@media (max-width: 30rem)': {
                    width: '2.5rem',
                    height: '2.5rem',
                  }
                }}>
                  {feature.icon}
                </Box>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default AiFitnessCoach;
