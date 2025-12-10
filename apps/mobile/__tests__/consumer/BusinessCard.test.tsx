/**
 * BusinessCard Component Tests
 * ============================
 *
 * Phase 15: Consumer Marketplace
 * Tests for the BusinessCard component.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import BusinessCard from '../../components/consumer/BusinessCard';

describe('BusinessCard', () => {
  const mockBusiness = {
    id: 'test-id',
    displayName: 'Test Business',
    logoUrl: 'https://example.com/logo.png',
    overallRating: 4.5,
    ratingCount: 120,
    completedJobsCount: 85,
    responseTimeMinutes: 30,
    badges: ['verified', 'top_rated'],
    categories: ['plumbing', 'electrical'],
    city: 'Buenos Aires',
    neighborhood: 'Palermo',
    distance: 2.5,
  };

  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders business name', () => {
    const { getByText } = render(
      <BusinessCard business={mockBusiness} onPress={mockOnPress} />
    );

    expect(getByText('Test Business')).toBeTruthy();
  });

  it('renders rating and review count', () => {
    const { getByText } = render(
      <BusinessCard business={mockBusiness} onPress={mockOnPress} />
    );

    expect(getByText('4.5')).toBeTruthy();
    expect(getByText('(120)')).toBeTruthy();
  });

  it('renders location', () => {
    const { getByText } = render(
      <BusinessCard business={mockBusiness} onPress={mockOnPress} />
    );

    expect(getByText('Palermo')).toBeTruthy();
  });

  it('renders distance when available', () => {
    const { getByText } = render(
      <BusinessCard business={mockBusiness} onPress={mockOnPress} />
    );

    expect(getByText('2.5 km')).toBeTruthy();
  });

  it('calls onPress when card is pressed', () => {
    const { getByText } = render(
      <BusinessCard business={mockBusiness} onPress={mockOnPress} />
    );

    fireEvent.press(getByText('Test Business'));
    expect(mockOnPress).toHaveBeenCalledWith(mockBusiness);
  });

  it('renders badges', () => {
    const { getByText } = render(
      <BusinessCard business={mockBusiness} onPress={mockOnPress} />
    );

    // Badge labels from constants
    expect(getByText('Verificado')).toBeTruthy();
    expect(getByText('Top')).toBeTruthy();
  });

  it('renders without logo gracefully', () => {
    const businessWithoutLogo = { ...mockBusiness, logoUrl: null };
    const { getByText } = render(
      <BusinessCard business={businessWithoutLogo} onPress={mockOnPress} />
    );

    expect(getByText('Test Business')).toBeTruthy();
  });

  it('renders without distance', () => {
    const businessWithoutDistance = { ...mockBusiness, distance: null };
    const { queryByText } = render(
      <BusinessCard business={businessWithoutDistance} onPress={mockOnPress} />
    );

    expect(queryByText('km')).toBeNull();
  });
});
