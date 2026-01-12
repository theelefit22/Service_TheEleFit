import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import EggIcon from '@mui/icons-material/Egg';
import RiceBowlIcon from '@mui/icons-material/RiceBowl';
import SetMealIcon from '@mui/icons-material/SetMeal';
import GrassIcon from '@mui/icons-material/Grass';

const CalorieResultsPopup = ({
  calculatedCalories,
  profileFormData,
  onGenerateMealPlan,
  onClose
}) => {
  const navigate = useNavigate();

  const macroCards = [
    {
      key: 'protein',
      icon: EggIcon,
      value: calculatedCalories.macros?.protein_g,
      label: 'PROTEIN',
      color: '#ff6b6b',
      borderColor: 'rgba(255, 107, 107, 0.4)',
      calories: calculatedCalories.macros?.protein_g * 4
    },
    {
      key: 'carbs',
      icon: RiceBowlIcon,
      value: calculatedCalories.macros?.carbs_g,
      label: 'CARBS',
      color: '#4ecdc4',
      borderColor: 'rgba(78, 205, 196, 0.4)',
      calories: calculatedCalories.macros?.carbs_g * 4
    },
    {
      key: 'fats',
      icon: SetMealIcon,
      value: calculatedCalories.macros?.fat_g,
      label: 'FATS',
      color: '#ffc371',
      borderColor: 'rgba(255, 195, 113, 0.4)',
      calories: calculatedCalories.macros?.fat_g * 9
    },
    {
      key: 'fiber',
      icon: GrassIcon,
      value: calculatedCalories.macros?.fiber_g,
      label: 'FIBER',
      color: '#81c784',
      borderColor: 'rgba(129, 199, 132, 0.4)',
      isDaily: true
    }
  ];

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          borderRadius: { xs: '0.75rem', sm: '1rem' },
          padding: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
          maxWidth: { xs: '95%', sm: '36.25rem' },
          margin: { xs: '1rem', sm: 'auto' },
          border: '0.125rem solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 1.5625rem 4.375rem rgba(0, 0, 0, 0.8)',
        }
      }}
      sx={{
        '& .MuiBackdrop-root': {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(1.25rem)',
        }
      }}
    >
      {/* Close Button */}
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          top: { xs: '0.625rem', sm: '0.75rem' },
          right: { xs: '0.625rem', sm: '0.75rem' },
          color: 'rgba(255, 255, 255, 0.6)',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          width: { xs: '1.75rem', sm: '2rem' },
          height: { xs: '1.75rem', sm: '2rem' },
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            color: '#fff',
            transform: 'rotate(90deg)',
          },
          transition: 'all 0.3s ease',
        }}
      >
        <CloseIcon sx={{ fontSize: { xs: '1rem', sm: '1.125rem' } }} />
      </IconButton>

      {/* Main Content Layout - Vertical */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: '0.875rem', sm: '1rem' },
        marginBottom: { xs: '1rem', sm: '1.25rem' }
      }}>
        {/* Calorie Display Section */}
        <Box sx={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '0.125rem solid rgba(255, 255, 255, 0.15)',
          borderRadius: '0.75rem',
          padding: { xs: '1rem', sm: '1.25rem 1rem' },
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, transparent 70%)',
            animation: 'pulse 4s ease-in-out infinite',
            pointerEvents: 'none',
          },
          '@keyframes pulse': {
            '0%, 100%': {
              transform: 'scale(1)',
              opacity: 0.5,
            },
            '50%': {
              transform: 'scale(1.1)',
              opacity: 0.8,
            }
          }
        }}>
          <LocalFireDepartmentIcon
            sx={{
              fontSize: { xs: '2rem', sm: '2.25rem' },
              color: '#CCD853',
              mb: { xs: 1, sm: 1.5 },
              animation: 'flicker 2.5s ease-in-out infinite',
              position: 'relative',
              zIndex: 1,
              '@keyframes flicker': {
                '0%, 100%': {
                  opacity: 1,
                  filter: 'drop-shadow(0 0 0.9375rem rgba(204, 216, 83, 0.6))',
                },
                '50%': {
                  opacity: 0.85,
                  filter: 'drop-shadow(0 0 1.5625rem rgba(204, 216, 83, 0.9))',
                }
              }
            }}
          />
          <Typography
            sx={{
              fontSize: { xs: '2.25rem', sm: '2.5rem', md: '2.625rem' },
              fontWeight: 800,
              color: '#CCD853',
              fontFamily: 'Poppins, sans-serif',
              lineHeight: 1,
              mb: { xs: 0.5, sm: 0.75 },
              position: 'relative',
              zIndex: 1,
              textShadow: '0 0.125rem 0.625rem rgba(204, 216, 83, 0.3)',
            }}
          >
            {calculatedCalories.targetCalories}
          </Typography>
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 0.5, sm: 0.75 },
            position: 'relative',
            zIndex: 1,
          }}>
            <Tooltip
              title="Learn how calories are calculated for your goals"
              arrow
              placement="top"
            >
              <Chip
                label="calories per day"
                icon={<InfoOutlinedIcon sx={{
                  fontSize: { xs: '0.5rem', sm: '0.625rem' },
                  color: 'rgba(255, 255, 255, 0.5) !important'
                }} />}
                onClick={() => navigate('/details?type=calories')}
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '0.0625rem solid rgba(255, 255, 255, 0.2)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: { xs: '0.5625rem', sm: '0.625rem' },
                  fontWeight: 600,
                  height: { xs: '1.25rem', sm: '1.375rem' },
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    '& .MuiChip-icon': {
                      color: 'rgba(255, 255, 255, 0.8) !important',
                    }
                  },
                  '& .MuiChip-label': {
                    padding: { xs: '0 0.375rem 0 0', sm: '0 0.5rem 0 0' },
                  },
                  '& .MuiChip-icon': {
                    marginLeft: { xs: '0.375rem', sm: '0.5rem' },
                    marginRight: { xs: '0.125rem', sm: '0.25rem' },
                  }
                }}
              />
            </Tooltip>
            <Tooltip
              title="Total Daily Energy Expenditure - Learn more"
              arrow
              placement="top"
            >
              <Chip
                label={`TDEE: ${calculatedCalories.tdee} cal`}
                icon={<InfoOutlinedIcon sx={{
                  fontSize: { xs: '0.5rem', sm: '0.625rem' },
                  color: 'rgba(255, 255, 255, 0.5) !important'
                }} />}
                onClick={() => navigate('/details?type=tdee')}
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '0.0625rem solid rgba(255, 255, 255, 0.2)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: { xs: '0.5625rem', sm: '0.625rem' },
                  fontWeight: 600,
                  height: { xs: '1.25rem', sm: '1.375rem' },
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    '& .MuiChip-icon': {
                      color: 'rgba(255, 255, 255, 0.8) !important',
                    }
                  },
                  '& .MuiChip-label': {
                    padding: { xs: '0 0.375rem 0 0', sm: '0 0.5rem 0 0' },
                  },
                  '& .MuiChip-icon': {
                    marginLeft: { xs: '0.375rem', sm: '0.5rem' },
                    marginRight: { xs: '0.125rem', sm: '0.25rem' },
                  }
                }}
              />
            </Tooltip>
          </Box>
        </Box>

        {/* Description Section */}
        <Box>
          <Typography sx={{
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: { xs: '0.75rem', sm: '0.8125rem' },
            lineHeight: 1.5,
            textAlign: 'center',
            px: { xs: 0.5, sm: 1 }
          }}>
            Based on your profile, you need to consume{' '}
            <Box component="span" sx={{
              color: '#CCD853',
              fontWeight: 700,
              background: 'rgba(204, 216, 83, 0.1)',
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
            }}>
              {calculatedCalories.targetCalories} calories per day
            </Box>{' '}
            to achieve your{' '}
            <Box component="span" sx={{ color: '#CCD853', fontWeight: 600 }}>
              {profileFormData.goal || 'fitness'}
            </Box>{' '}
            goal.
          </Typography>
        </Box>

        {/* Macros Section - Horizontal Grid */}
        {calculatedCalories.macros && (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(4, 1fr)'
            },
            gap: { xs: 0.625, sm: 0.75, md: 1 }
          }}>
            {macroCards.map((macro) => {
              const IconComponent = macro.icon;
              return (
                <Box
                  key={macro.key}
                  sx={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '0.125rem solid',
                    borderColor: macro.borderColor,
                    color: macro.color,
                    borderRadius: '0.625rem',
                    padding: { xs: '0.625rem 0.5rem', sm: '0.75rem 0.5rem' },
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '0.125rem',
                      background: 'currentColor',
                      opacity: 0.3,
                    },
                    '&:hover': {
                      transform: 'translateX(0.3125rem)',
                      boxShadow: '0 0.375rem 1.25rem rgba(0, 0, 0, 0.3)',
                    }
                  }}
                >
                  <IconComponent sx={{
                    fontSize: { xs: '1rem', sm: '1.125rem' },
                    mb: { xs: 0.25, sm: 0.5 }
                  }} />
                  <Typography sx={{
                    fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem' },
                    fontWeight: 700,
                    fontFamily: 'Poppins, sans-serif',
                    lineHeight: 1,
                    mb: 0.25
                  }}>
                    {macro.value}g
                  </Typography>
                  <Typography sx={{
                    fontSize: { xs: '0.5rem', sm: '0.5625rem' },
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    mb: 0.25
                  }}>
                    {macro.label}
                  </Typography>
                  <Typography sx={{
                    fontSize: { xs: '0.5rem', sm: '0.5625rem' },
                    color: 'rgba(255, 255, 255, 0.5)'
                  }}>
                    {macro.isDaily
                      ? 'Daily Target'
                      : `${Math.round((macro.calories / calculatedCalories.targetCalories) * 100)}%`
                    }
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Bottom Action Buttons */}
      <Box sx={{
        display: 'flex',
        gap: { xs: 0.625, sm: 0.75, md: 1 },
        pt: { xs: 1.25, sm: 1.5 },
        borderTop: '0.0625rem solid rgba(255, 255, 255, 0.1)',
        flexDirection: { xs: 'column', sm: 'row' }
      }}>
        <Button
          onClick={onClose}
          fullWidth
          sx={{
            flex: 1,
            padding: { xs: '0.75rem 1rem', sm: '0.625rem 1.25rem' },
            borderRadius: { xs: '0.5rem', sm: '0.625rem' },
            fontSize: { xs: '0.625rem', sm: '0.6875rem' },
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.03125rem',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: 'rgba(255, 255, 255, 0.7)',
            border: '0.0625rem solid rgba(255, 255, 255, 0.15)',
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              transform: 'translateY(-0.0625rem)',
            }
          }}
        >
          NO, THANKS
        </Button>
        <Button
          onClick={onGenerateMealPlan}
          fullWidth
          startIcon={<RestaurantIcon sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }} />}
          sx={{
            flex: 1,
            padding: { xs: '0.75rem 1rem', sm: '0.625rem 1.25rem' },
            borderRadius: { xs: '0.5rem', sm: '0.625rem' },
            fontSize: { xs: '0.625rem', sm: '0.6875rem' },
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.03125rem',
            background: 'linear-gradient(135deg, #CCD853 0%, #B8D843 100%)',
            color: '#1A1F14',
            boxShadow: '0 0.25rem 1.25rem rgba(204, 216, 83, 0.35)',
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'linear-gradient(135deg, #B8D843 0%, #A8C833 100%)',
              transform: 'translateY(-0.0625rem)',
              boxShadow: '0 0.375rem 1.5625rem rgba(204, 216, 83, 0.45)',
            }
          }}
        >
          Generate Meal Plan
        </Button>
      </Box>
    </Dialog>
  );
};

export default CalorieResultsPopup;
