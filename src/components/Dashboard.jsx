import React, { useState, useEffect, useRef } from 'react'
import { supabase, getDeviceId, canSubmit, getRemainingWaitTime, setLastSubmissionTime, saveDraft, getDraft, clearDraft } from '../lib/supabase'
import { evaluateIdea, evaluateFeedback } from '../lib/openai'
import { SUPPORTED_LANGUAGES, getCurrentLanguage, setCurrentLanguage, translateText, getUIText } from '../lib/translate'

const Dashboard = () => {
  const [ideas, setIdeas] = useState([])
  const [mySubmissions, setMySubmissions] = useState([])
  const [selectedIdea, setSelectedIdea] = useState(null)
  const [refreshTimer, setRefreshTimer] = useState(30)
  const [isLoading, setIsLoading] = useState(false)
  const [currentLanguage, setCurrentLang] = useState('en')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    whoToServe: '',
    productIdea: '',
    categories: [],
    source: '',
    otherSource: '',
    userPainPoints: '',
    existingAlternatives: '',
    userCapabilities: ''
  })

  // Feedback form state
  const [feedbackData, setFeedbackData] = useState({
    feedbackText: '',
    contactInfo: ''
  })

  const [rateLimitTime, setRateLimitTime] = useState(0)
  const intervalRef = useRef()
  const rateLimitIntervalRef = useRef()

  // Categories list
  const CATEGORIES = [
    'technology', 'healthcare', 'education', 'finance', 'environment', 
    'social', 'entertainment', 'transportation', 'food', 'other'
  ]

  // Sources list
  const SOURCES = [
    'social_media', 'search_engine', 'friend_referral', 'advertisement', 'other'
  ]

  // Load draft on component mount
  useEffect(() => {
    const draft = getDraft()
    if (draft) {
      setFormData(draft)
    }
    loadIdeas()
    loadMySubmissions()
    updateRateLimit()

    // Set up auto-refresh
    intervalRef.current = setInterval(() => {
      setRefreshTimer(prev => {
        if (prev <= 1) {
          loadIdeas()
          loadMySubmissions()
          return 30
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (rateLimitIntervalRef.current) clearInterval(rateLimitIntervalRef.current)
    }
  }, [])

  // Save draft whenever form data changes
  useEffect(() => {
    if (formData.fullName || formData.whoToServe || formData.productIdea) {
      saveDraft(formData)
    }
  }, [formData])

  const updateRateLimit = () => {
    const remaining = getRemainingWaitTime()
    setRateLimitTime(remaining)
    
    if (remaining > 0) {
      rateLimitIntervalRef.current = setInterval(() => {
        const newRemaining = getRemainingWaitTime()
        setRateLimitTime(newRemaining)
        if (newRemaining <= 0) {
          clearInterval(rateLimitIntervalRef.current)
        }
      }, 1000)
    }
  }

  const loadIdeas = async () => {
    try {
      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .order('timestamp', { ascending: false })
      
      if (error) {
        console.error('Error loading ideas:', error)
        if (error.code === '42501') {
          console.error('Permission Denied (RLS)')
          setError('Permission Denied (RLS)')
        } else {
          console.error(`System Error: ${error.message}`)
          setError(`System Error: ${error.message}`)
        }
      } else {
        setIdeas(data || [])
      }
    } catch (err) {
      console.error('System Error:', err.message)
      setError(`System Error: ${err.message}`)
    }
  }

  const loadMySubmissions = async () => {
    try {
      const deviceId = getDeviceId()
      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .eq('device_id', deviceId)
        .order('timestamp', { ascending: false })
      
      if (error) {
        console.error('Error loading submissions:', error)
      } else {
        setMySubmissions(data || [])
      }
    } catch (err) {
      console.error('Error loading submissions:', err)
    }
  }

  const checkForDuplicates = async (productIdea) => {
    try {
      const { data, error } = await supabase
        .from('ideas')
        .select('product_idea')
        .ilike('product_idea', `%${productIdea.toLowerCase()}%`)
      
      return data && data.length > 0
    } catch (err) {
      console.warn('Error checking duplicates:', err)
      return false
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleCategoryToggle = (category) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }))
  }

  const getWordCount = (text) => {
    return text.trim() ? text.trim().split(/\s+/).length : 0
  }

  const validateForm = () => {
    if (!formData.fullName.trim()) return 'Full name is required'
    if (!formData.whoToServe.trim()) return 'Who you serve is required'
    if (!formData.productIdea.trim()) return 'Product idea is required'
    if (getWordCount(formData.whoToServe) > 50) return 'Who you serve must be 50 words or less'
    if (getWordCount(formData.productIdea) > 150) return 'Product idea must be 150 words or less'
    if (!canSubmit()) return 'Please wait before submitting again'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      // Check for duplicates
      const isDuplicate = await checkForDuplicates(formData.productIdea)
      
      // Prepare submission data
      const submissionData = {
        ...formData,
        source: formData.source === 'other' ? formData.otherSource : formData.source,
        device_id: getDeviceId()
      }

      // Evaluate with AI
      console.log('Evaluating idea with AI...')
      const evaluation = await evaluateIdea(submissionData)
      
      let visible = evaluation.valid
      let rejectionReason = null
      
      if (!evaluation.valid) {
        rejectionReason = evaluation.reason
        visible = false
        console.log(`Rejected: ${evaluation.explanation}`)
        setError(`Rejected: ${evaluation.explanation}`)
      }

      // Check if this device has submitted this idea before
      const { data: existingSubmissions } = await supabase
        .from('ideas')
        .select('submission_attempts')
        .eq('device_id', getDeviceId())
        .ilike('product_idea', `%${formData.productIdea}%`)
        .single()

      const submissionAttempts = existingSubmissions ? existingSubmissions.submission_attempts + 1 : 1

      // Insert into database
      const { data, error } = await supabase
        .from('ideas')
        .insert({
          full_name: submissionData.fullName,
          who_to_serve: submissionData.whoToServe,
          product_idea: submissionData.productIdea,
          categories: submissionData.categories,
          source: submissionData.source,
          device_id: submissionData.device_id,
          user_pain_points: submissionData.userPainPoints,
          existing_alternatives: submissionData.existingAlternatives,
          user_capabilities: submissionData.userCapabilities,
          visible: visible,
          rejection_reason: rejectionReason,
          score: evaluation.score || 0,
          submission_attempts: submissionAttempts
        })
        .select()
        .single()

      if (error) {
        console.error('Database error:', error)
        if (error.code === '42501') {
          setError('Permission Denied (RLS)')
          console.error('Permission Denied (RLS)')
        } else {
          setError(`System Error: ${error.message}`)
          console.error(`System Error: ${error.message}`)
        }
      } else {
        if (evaluation.valid) {
          setSuccess('Submission accepted')
          console.log('Submission accepted')
          // Clear form and draft
          setFormData({
            fullName: '',
            whoToServe: '',
            productIdea: '',
            categories: [],
            source: '',
            otherSource: '',
            userPainPoints: '',
            existingAlternatives: '',
            userCapabilities: ''
          })
          clearDraft()
        }
        
        setLastSubmissionTime()
        updateRateLimit()
        loadIdeas()
        loadMySubmissions()
      }
    } catch (err) {
      console.error('Submission error:', err)
      setError(`System Error: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault()
    
    if (!feedbackData.feedbackText.trim()) {
      setError('Feedback text is required')
      return
    }

    if (getWordCount(feedbackData.feedbackText) > 125) {
      setError('Feedback must be 125 words or less')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Evaluate feedback for spam
      console.log('Evaluating feedback with AI...')
      const evaluation = await evaluateFeedback(feedbackData.feedbackText)
      
      if (!evaluation.valid) {
        setError('Rejected: Feedback appears to be spam or inappropriate')
        console.log('Rejected: Feedback flagged as spam')
        return
      }

      const { error } = await supabase
        .from('feedback')
        .insert({
          feedback_text: feedbackData.feedbackText,
          contact_info: feedbackData.contactInfo || null,
          device_id: getDeviceId()
        })

      if (error) {
        console.error('Feedback submission error:', error)
        setError(`System Error: ${error.message}`)
      } else {
        setSuccess('Feedback submitted successfully')
        console.log('Feedback submitted successfully')
        setFeedbackData({ feedbackText: '', contactInfo: '' })
      }
    } catch (err) {
      console.error('Feedback error:', err)
      setError(`System Error: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (seconds) => {
    return Math.ceil(seconds / 1000)
  }

  const InfoIcon = ({ tooltip }) => (
    <div className="info-icon" data-tooltip={tooltip}>
      ?
    </div>
  )

  return (
    <div className="dashboard">
      {/* Language Selector */}
      <div className="language-selector">
        <select 
          value={currentLanguage} 
          onChange={(e) => {
            setCurrentLang(e.target.value)
            setCurrentLanguage(e.target.value)
          }}
        >
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      {/* Header */}
      <div className="header">
        <h1>{getUIText('appTitle')}</h1>
      </div>

      {/* Error/Success Messages */}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Top Row - Ideas Lists */}
      <div className="top-row">
        {/* All Ideas */}
        <div className="ideas-list">
          <div className="list-header">
            <h2>{getUIText('allIdeas')}</h2>
            <div className="refresh-timer">
              <span>🕒</span>
              <span>{refreshTimer}{getUIText('seconds')}</span>
            </div>
          </div>
          {ideas.map(idea => (
            <div 
              key={idea.id} 
              className={`idea-item ${!idea.visible ? 'hidden' : ''}`}
              onClick={() => setSelectedIdea(idea)}
            >
              <h3>{idea.full_name}</h3>
              <p><strong>Serves:</strong> {idea.who_to_serve}</p>
              <p><strong>Idea:</strong> {idea.visible ? idea.product_idea : '••••••••••••••••••••'}</p>
              {idea.categories && (
                <div className="idea-categories">
                  {idea.categories.map(cat => (
                    <span key={cat} className="category-tag">
                      {getUIText(`categories.${cat}`)}
                    </span>
                  ))}
                </div>
              )}
              {idea.score && <p><strong>Score:</strong> {idea.score}/100</p>}
            </div>
          ))}
        </div>

        {/* My Submissions */}
        <div className="my-submissions">
          <div className="list-header">
            <h2>{getUIText('mySubmissions')}</h2>
            <div className="refresh-timer">
              <span>🕒</span>
              <span>{refreshTimer}{getUIText('seconds')}</span>
            </div>
          </div>
          {mySubmissions.map(idea => (
            <div 
              key={idea.id} 
              className="idea-item"
              onClick={() => setSelectedIdea(idea)}
            >
              <h3>{idea.full_name}</h3>
              <p><strong>Status:</strong> {idea.visible ? 'Approved' : 'Rejected'}</p>
              <p><strong>Idea:</strong> {idea.product_idea}</p>
              {idea.rejection_reason && (
                <p><strong>Reason:</strong> {idea.rejection_reason}</p>
              )}
              {idea.score && <p><strong>Score:</strong> {idea.score}/100</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Middle Row - Submission Form */}
      <div className="submission-form">
        <h2>{getUIText('submitIdea')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>{getUIText('fullName')}</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>
                {getUIText('whoYouServe')}
                <InfoIcon tooltip={getUIText('tooltips.whoYouServe')} />
              </label>
              <textarea
                value={formData.whoToServe}
                onChange={(e) => handleInputChange('whoToServe', e.target.value)}
                required
              />
              <div className={`word-counter ${getWordCount(formData.whoToServe) > 50 ? 'warning' : ''}`}>
                {getWordCount(formData.whoToServe)}/50 {getUIText('wordLimit')}
              </div>
            </div>

            <div className="form-group full-width">
              <label>
                {getUIText('productIdea')}
                <InfoIcon tooltip={getUIText('tooltips.productIdea')} />
              </label>
              <textarea
                value={formData.productIdea}
                onChange={(e) => handleInputChange('productIdea', e.target.value)}
                required
              />
              <div className={`word-counter ${getWordCount(formData.productIdea) > 150 ? 'warning' : ''}`}>
                {getWordCount(formData.productIdea)}/150 {getUIText('wordLimit')}
              </div>
            </div>

            <div className="form-group">
              <label>
                {getUIText('userPainPoints')}
                <InfoIcon tooltip={getUIText('tooltips.userPainPoints')} />
              </label>
              <textarea
                value={formData.userPainPoints}
                onChange={(e) => handleInputChange('userPainPoints', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>
                {getUIText('existingAlternatives')}
                <InfoIcon tooltip={getUIText('tooltips.existingAlternatives')} />
              </label>
              <textarea
                value={formData.existingAlternatives}
                onChange={(e) => handleInputChange('existingAlternatives', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>
                {getUIText('userCapabilities')}
                <InfoIcon tooltip={getUIText('tooltips.userCapabilities')} />
              </label>
              <textarea
                value={formData.userCapabilities}
                onChange={(e) => handleInputChange('userCapabilities', e.target.value)}
              />
            </div>

            <div className="form-group full-width">
              <label>{getUIText('categories')}</label>
              <div className="categories-grid">
                {CATEGORIES.map(category => (
                  <div key={category} className="category-checkbox">
                    <input
                      type="checkbox"
                      id={category}
                      checked={formData.categories.includes(category)}
                      onChange={() => handleCategoryToggle(category)}
                    />
                    <label htmlFor={category}>{getUIText(`categories.${category}`)}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>{getUIText('howYouHeard')}</label>
              <select
                value={formData.source}
                onChange={(e) => handleInputChange('source', e.target.value)}
                required
              >
                <option value="">Select...</option>
                {SOURCES.map(source => (
                  <option key={source} value={source}>
                    {getUIText(`sources.${source}`)}
                  </option>
                ))}
              </select>
              {formData.source === 'other' && (
                <div className="other-source">
                  <input
                    type="text"
                    placeholder="Please specify..."
                    value={formData.otherSource}
                    onChange={(e) => handleInputChange('otherSource', e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          </div>

          <button 
            type="submit" 
            className="submit-button"
            disabled={isLoading || !canSubmit() || rateLimitTime > 0}
          >
            {isLoading ? <span className="loading"></span> : getUIText('submitButton')}
          </button>

          {rateLimitTime > 0 && (
            <div className="rate-limit-message">
              {getUIText('rateLimitMessage', { time: formatTime(rateLimitTime) })}
            </div>
          )}
        </form>
      </div>

      {/* Process Diagram */}
      <div className="process-diagram">
        <h2>{getUIText('processFlow')}</h2>
        <div className="process-steps">
          <div className="process-step">
            <h3>AI Evaluation</h3>
            <p>{getUIText('aiEvaluation')}</p>
          </div>
          <div className="process-arrow">→</div>
          <div className="process-step">
            <h3>Scoring</h3>
            <p>{getUIText('scoring')}</p>
          </div>
          <div className="process-arrow">→</div>
          <div className="process-step">
            <h3>Human Review</h3>
            <p>{getUIText('humanReview')}</p>
          </div>
          <div className="process-arrow">→</div>
          <div className="process-step">
            <h3>Mentoring</h3>
            <p>{getUIText('mentoring')}</p>
          </div>
        </div>
      </div>

      {/* Feedback Form */}
      <div className="feedback-form">
        <h2>{getUIText('feedback')}</h2>
        <form onSubmit={handleFeedbackSubmit}>
          <div className="form-group">
            <textarea
              placeholder={getUIText('feedbackPlaceholder')}
              value={feedbackData.feedbackText}
              onChange={(e) => setFeedbackData(prev => ({ ...prev, feedbackText: e.target.value }))}
              required
            />
            <div className={`word-counter ${getWordCount(feedbackData.feedbackText) > 125 ? 'warning' : ''}`}>
              {getWordCount(feedbackData.feedbackText)}/125 {getUIText('wordLimit')}
            </div>
          </div>
          <div className="form-group">
            <input
              type="text"
              placeholder={getUIText('contactInfo')}
              value={feedbackData.contactInfo}
              onChange={(e) => setFeedbackData(prev => ({ ...prev, contactInfo: e.target.value }))}
            />
          </div>
          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? <span className="loading"></span> : getUIText('submitFeedback')}
          </button>
        </form>
      </div>

      {/* Modal for detailed view */}
      {selectedIdea && (
        <div className="modal" onClick={() => setSelectedIdea(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedIdea(null)}>×</button>
            <h2>{selectedIdea.full_name}</h2>
            <p><strong>Who They Serve:</strong> {selectedIdea.who_to_serve}</p>
            <p><strong>Product Idea:</strong> {selectedIdea.product_idea}</p>
            {selectedIdea.user_pain_points && (
              <p><strong>Pain Points:</strong> {selectedIdea.user_pain_points}</p>
            )}
            {selectedIdea.existing_alternatives && (
              <p><strong>Alternatives:</strong> {selectedIdea.existing_alternatives}</p>
            )}
            {selectedIdea.user_capabilities && (
              <p><strong>User Capabilities:</strong> {selectedIdea.user_capabilities}</p>
            )}
            {selectedIdea.categories && (
              <p><strong>Categories:</strong> {selectedIdea.categories.join(', ')}</p>
            )}
            <p><strong>Source:</strong> {selectedIdea.source}</p>
            {selectedIdea.score && <p><strong>Score:</strong> {selectedIdea.score}/100</p>}
            {selectedIdea.rejection_reason && (
              <p><strong>Rejection Reason:</strong> {selectedIdea.rejection_reason}</p>
            )}
            <p><strong>Submitted:</strong> {new Date(selectedIdea.timestamp).toLocaleDateString()}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard